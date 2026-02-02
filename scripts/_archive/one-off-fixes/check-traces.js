require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTraces() {
  console.log('=== Database Summary ===\n');

  const conversationCount = await prisma.conversation.count();
  console.log(`Total Conversations: ${conversationCount}`);

  const messageCount = await prisma.message.count();
  console.log(`Total Messages: ${messageCount}`);

  const traceCount = await prisma.trace.count();
  console.log(`Total Traces: ${traceCount}\n`);

  const conversations = await prisma.conversation.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      messages: { orderBy: { stepNumber: 'asc' } },
      traces: true,
    },
  });

  console.log('=== Latest Conversations ===\n');

  for (const conv of conversations) {
    console.log(`Conversation ID: ${conv.id}`);
    console.log(`User ID: ${conv.userId}`);
    console.log(`Status: ${conv.status}`);
    console.log(`Created: ${conv.createdAt.toISOString()}`);
    console.log(`Messages: ${conv.messages.length}`);
    console.log(`Traces: ${conv.traces.length}\n`);

    console.log('Message Flow:');
    for (const msg of conv.messages) {
      const preview = msg.content.substring(0, 80);
      console.log(`  ${msg.stepNumber}. [${msg.role}]: ${preview}${msg.content.length > 80 ? '...' : ''}`);
    }
    console.log('');

    if (conv.traces.length > 0) {
      const trace = conv.traces[0];
      console.log('Trace Details:');
      console.log(`  Model: ${trace.modelUsed}`);
      console.log(`  Total Tokens: ${trace.totalTokens} (prompt: ${trace.promptTokens}, completion: ${trace.completionTokens})`);
      console.log(`  Latency: ${trace.latencyMs}ms`);
      console.log(`  User Feedback: ${trace.userFeedback || 'none'}`);
      console.log(`  Extracted Context:`, JSON.stringify(trace.extractedContext, null, 2).substring(0, 200) + '...');
      console.log('');
    }

    console.log('---\n');
  }

  await prisma.$disconnect();
}

checkTraces().catch(console.error);
