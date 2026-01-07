import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createMessage, CLAUDE_MODEL } from '@/lib/claude';
import { UnstructuredClient } from 'unstructured-client';
import { Strategy } from 'unstructured-client/sdk/models/shared';
import { getOrCreateDefaultProject } from '@/lib/projects';
import { getExperimentVariant } from '@/lib/statsig';

export const maxDuration = 60;

const unstructured = new UnstructuredClient({
  security: {
    apiKeyAuth: process.env.UNSTRUCTURED_API_KEY || '',
  },
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text using unstructured.io
    console.log('[Upload] Extracting text from file:', file.name);
    const extractionResult = await unstructured.general.partition({
      partitionParameters: {
        files: {
          content: buffer,
          fileName: file.name,
        },
        strategy: Strategy.Auto,
      },
    });

    // Combine all elements into text
    const elements = typeof extractionResult === 'string'
      ? JSON.parse(extractionResult)
      : extractionResult;

    const extractedText = elements
      ?.map((el: any) => el.text)
      .filter(Boolean)
      .join('\n\n') || '';

    if (!extractedText) {
      return NextResponse.json(
        { error: 'Could not extract text from file' },
        { status: 400 }
      );
    }

    console.log('[Upload] Extracted text length:', extractedText.length);

    // Generate summary using Claude
    const summaryResponse = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Briefly summarize this business document in 1-2 sentences. Focus on what business/product it's about:\n\n${extractedText.slice(0, 4000)}`
      }],
      temperature: 0.7,
    }, 'document_summary');

    const summary = summaryResponse.content[0]?.type === 'text'
      ? summaryResponse.content[0].text
      : 'Document uploaded successfully.';

    console.log('[Upload] Generated summary');

    // Get session to check if user is authenticated
    const session = await getServerSession(authOptions);
    const authenticatedUserId = session?.user?.id || null;

    // Get or create project (creates guest user + project for unauthenticated users)
    const { userId, project, isGuest } = await getOrCreateDefaultProject(authenticatedUserId);

    // Use database userId for Statsig (ensures consistency with event logging)
    const experimentVariant = await getExperimentVariant(userId);

    // Create conversation with document context
    const conversation = await prisma.conversation.create({
      data: {
        userId,
        projectId: project.id,
        status: 'in_progress',
        experimentVariant,
      },
    });

    // Store document context as first system message
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: `Context from uploaded document (${file.name}):\n\n${extractedText}\n\nUse this as background context. Ask clarifying questions to fill gaps and deepen understanding. Don't rehash what's already clear from the document.`,
        stepNumber: 0, // System message
      },
    });

    // Generate first context-aware question
    const firstQuestionResponse = await createMessage({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Based on this document summary, ask one focused clarifying question to understand their business better:\n\n${summary}\n\nIMPORTANT: Output ONLY the question itself. No preambles.`
        }
      ],
      temperature: 0.7,
    }, 'document_first_question');

    const firstQuestion = firstQuestionResponse.content[0]?.type === 'text'
      ? firstQuestionResponse.content[0].text
      : 'What specific aspects of your strategy would you like to focus on?';

    // Save first question
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: firstQuestion,
        stepNumber: 1,
      },
    });

    // Log document upload event
    await prisma.event.create({
      data: {
        conversationId: conversation.id,
        eventType: 'document_uploaded',
        eventData: {
          fileType: file.type,
          fileSize: file.size,
          filename: file.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      summary,
      extractedText,
      experimentVariant,
      // Include guestUserId for session transfer when guest authenticates
      ...(isGuest && { guestUserId: userId }),
    });

  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}
