// src/lib/__tests__/contracts/persistence-contracts.test.ts
/**
 * Fragment and Document Persistence Contract Tests
 *
 * Verifies that fragment and document creation conforms to contracts.
 */

import {
  validateFragment,
  validateFragmentDimensionTag,
  validateFragmentCreationResult,
  isValidDimension,
  VALID_DIMENSIONS,
  FragmentContract,
  FragmentDimensionTagContract,
  DocumentContract,
  validateDocument,
  validateDocumentUploadInput,
  isValidDocumentStatus,
  DOCUMENT_STATUSES,
  validateProject,
  isValidProjectStatus,
  PROJECT_STATUSES,
  ProjectContract,
} from '@/lib/contracts/persistence';

describe('Persistence Contracts', () => {
  describe('isValidDimension', () => {
    it('should accept all valid dimensions', () => {
      for (const dim of VALID_DIMENSIONS) {
        expect(isValidDimension(dim)).toBe(true);
      }
    });

    it('should reject invalid dimensions', () => {
      expect(isValidDimension('invalid_dimension')).toBe(false);
      expect(isValidDimension('CUSTOMER_MARKET')).toBe(false); // case sensitive
      expect(isValidDimension('')).toBe(false);
    });
  });

  describe('FragmentContract', () => {
    const validFragment: FragmentContract = {
      id: 'frag_abc123',
      projectId: 'proj_xyz789',
      conversationId: 'conv_def456',
      content: 'SMBs struggle with invoice processing',
      contentType: 'theme',
      status: 'active',
      confidence: 'HIGH',
    };

    it('should validate a correct fragment', () => {
      expect(validateFragment(validFragment)).toBe(true);
    });

    it('should reject fragment with missing id', () => {
      const { id, ...invalid } = validFragment;
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with missing projectId', () => {
      const { projectId, ...invalid } = validFragment;
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with neither conversationId nor documentId', () => {
      const { conversationId, ...invalid } = validFragment;
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should accept fragment with only documentId (no conversationId)', () => {
      const documentSourcedFragment: FragmentContract = {
        id: 'frag_doc123',
        projectId: 'proj_xyz789',
        documentId: 'doc_abc456',
        content: 'Theme extracted from document',
        contentType: 'theme',
        status: 'active',
        confidence: 'MEDIUM',
      };
      expect(validateFragment(documentSourcedFragment)).toBe(true);
    });

    it('should accept fragment with both conversationId and documentId', () => {
      const bothSources: FragmentContract = {
        ...validFragment,
        documentId: 'doc_abc456',
      };
      expect(validateFragment(bothSources)).toBe(true);
    });

    it('should reject fragment with empty content', () => {
      const invalid = { ...validFragment, content: '' };
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with wrong contentType', () => {
      const invalid = { ...validFragment, contentType: 'insight' };
      expect(validateFragment(invalid)).toBe(false);
    });

    it('should reject fragment with wrong status', () => {
      const invalid = { ...validFragment, status: 'archived' };
      expect(validateFragment(invalid)).toBe(false);
    });
  });

  describe('FragmentDimensionTagContract', () => {
    const validTag: FragmentDimensionTagContract = {
      id: 'tag_abc123',
      fragmentId: 'frag_abc123',
      dimension: 'customer_market',
      confidence: 'HIGH',
    };

    it('should validate a correct dimension tag', () => {
      expect(validateFragmentDimensionTag(validTag)).toBe(true);
    });

    it('should reject tag with missing fragmentId', () => {
      const { fragmentId, ...invalid } = validTag;
      expect(validateFragmentDimensionTag(invalid)).toBe(false);
    });

    it('should reject tag with invalid dimension', () => {
      const invalid = { ...validTag, dimension: 'invalid_dimension' };
      expect(validateFragmentDimensionTag(invalid)).toBe(false);
    });

    it('should accept tag without confidence (optional)', () => {
      const { confidence, ...withoutConfidence } = validTag;
      expect(validateFragmentDimensionTag(withoutConfidence)).toBe(true);
    });
  });

  describe('FragmentCreationResultContract', () => {
    const validResult = {
      fragments: [
        {
          id: 'frag_1',
          projectId: 'proj_1',
          conversationId: 'conv_1',
          content: 'Theme content 1',
          contentType: 'theme',
          status: 'active',
        },
        {
          id: 'frag_2',
          projectId: 'proj_1',
          conversationId: 'conv_1',
          content: 'Theme content 2',
          contentType: 'theme',
          status: 'active',
        },
      ],
      dimensionTags: [
        { id: 'tag_1', fragmentId: 'frag_1', dimension: 'customer_market' },
        { id: 'tag_2', fragmentId: 'frag_1', dimension: 'problem_opportunity' },
        { id: 'tag_3', fragmentId: 'frag_2', dimension: 'value_proposition' },
      ],
    };

    it('should validate a correct fragment creation result', () => {
      expect(validateFragmentCreationResult(validResult)).toBe(true);
    });

    it('should reject result with no fragments', () => {
      const invalid = { ...validResult, fragments: [] };
      expect(validateFragmentCreationResult(invalid)).toBe(false);
    });

    it('should reject result with invalid fragment', () => {
      const invalid = {
        ...validResult,
        fragments: [{ id: 'frag_1', content: 'Missing required fields' }],
      };
      expect(validateFragmentCreationResult(invalid)).toBe(false);
    });

    it('should reject result with invalid dimension tag', () => {
      const invalid = {
        ...validResult,
        dimensionTags: [{ id: 'tag_1', fragmentId: 'frag_1', dimension: 'invalid' }],
      };
      expect(validateFragmentCreationResult(invalid)).toBe(false);
    });

    it('should accept result with empty dimension tags', () => {
      const valid = { ...validResult, dimensionTags: [] };
      expect(validateFragmentCreationResult(valid)).toBe(true);
    });

    it('should accept result with document-sourced fragments', () => {
      const documentSourcedResult = {
        fragments: [
          {
            id: 'frag_1',
            projectId: 'proj_1',
            documentId: 'doc_1',
            content: 'Theme from document',
            contentType: 'theme',
            status: 'active',
          },
        ],
        dimensionTags: [
          { id: 'tag_1', fragmentId: 'frag_1', dimension: 'customer_market' },
        ],
      };
      expect(validateFragmentCreationResult(documentSourcedResult)).toBe(true);
    });
  });

  describe('DocumentContract', () => {
    describe('isValidDocumentStatus', () => {
      it('should accept all valid statuses', () => {
        for (const status of DOCUMENT_STATUSES) {
          expect(isValidDocumentStatus(status)).toBe(true);
        }
      });

      it('should reject invalid statuses', () => {
        expect(isValidDocumentStatus('invalid')).toBe(false);
        expect(isValidDocumentStatus('PENDING')).toBe(false);
        expect(isValidDocumentStatus('')).toBe(false);
      });
    });

    const validDocument: DocumentContract = {
      id: 'doc_abc123',
      projectId: 'proj_xyz789',
      fileName: 'business-plan.pdf',
      fileType: 'application/pdf',
      status: 'pending',
    };

    it('should validate a correct document', () => {
      expect(validateDocument(validDocument)).toBe(true);
    });

    it('should validate document with all optional fields', () => {
      const fullDocument: DocumentContract = {
        ...validDocument,
        fileSizeBytes: 1024000,
        uploadContext: 'Our 2024 business plan document',
        status: 'complete',
        processedAt: '2024-01-15T10:30:00Z',
      };
      expect(validateDocument(fullDocument)).toBe(true);
    });

    it('should validate failed document with error message', () => {
      const failedDocument: DocumentContract = {
        ...validDocument,
        status: 'failed',
        errorMessage: 'Could not extract text from document',
      };
      expect(validateDocument(failedDocument)).toBe(true);
    });

    it('should reject document with missing id', () => {
      const { id, ...invalid } = validDocument;
      expect(validateDocument(invalid)).toBe(false);
    });

    it('should reject document with missing projectId', () => {
      const { projectId, ...invalid } = validDocument;
      expect(validateDocument(invalid)).toBe(false);
    });

    it('should reject document with missing fileName', () => {
      const { fileName, ...invalid } = validDocument;
      expect(validateDocument(invalid)).toBe(false);
    });

    it('should reject document with invalid status', () => {
      const invalid = { ...validDocument, status: 'invalid' };
      expect(validateDocument(invalid)).toBe(false);
    });
  });

  describe('DocumentUploadInputContract', () => {
    const validInput = {
      projectId: 'proj_xyz789',
      fileName: 'strategy.pdf',
      fileType: 'application/pdf',
    };

    it('should validate correct upload input', () => {
      expect(validateDocumentUploadInput(validInput)).toBe(true);
    });

    it('should validate upload input with optional fields', () => {
      const fullInput = {
        ...validInput,
        fileSizeBytes: 500000,
        uploadContext: 'Our strategic plan for Q1',
      };
      expect(validateDocumentUploadInput(fullInput)).toBe(true);
    });

    it('should reject upload input with missing projectId', () => {
      const { projectId, ...invalid } = validInput;
      expect(validateDocumentUploadInput(invalid)).toBe(false);
    });

    it('should reject upload input with missing fileName', () => {
      const { fileName, ...invalid } = validInput;
      expect(validateDocumentUploadInput(invalid)).toBe(false);
    });

    it('should reject upload input with invalid fileSizeBytes type', () => {
      const invalid = { ...validInput, fileSizeBytes: '500000' };
      expect(validateDocumentUploadInput(invalid)).toBe(false);
    });
  });

  describe('ProjectContract', () => {
    const validProject = {
      id: 'proj_abc123',
      userId: 'user_xyz789',
      name: 'My Strategy',
      status: 'active',
      isDemo: false,
    };

    it('should validate a correct project', () => {
      expect(validateProject(validProject)).toBe(true);
    });

    it('should validate a demo project', () => {
      const demoProject = { ...validProject, isDemo: true, name: 'Demo: Catalyst Strategy' };
      expect(validateProject(demoProject)).toBe(true);
    });

    it('should reject project with missing id', () => {
      const { id, ...invalid } = validProject;
      expect(validateProject(invalid)).toBe(false);
    });

    it('should reject project with missing userId', () => {
      const { userId, ...invalid } = validProject;
      expect(validateProject(invalid)).toBe(false);
    });

    it('should reject project with missing name', () => {
      const { name, ...invalid } = validProject;
      expect(validateProject(invalid)).toBe(false);
    });

    it('should reject project with invalid status', () => {
      const invalid = { ...validProject, status: 'invalid' };
      expect(validateProject(invalid)).toBe(false);
    });

    it('should reject project with non-boolean isDemo', () => {
      const invalid = { ...validProject, isDemo: 'true' };
      expect(validateProject(invalid)).toBe(false);
    });
  });
});
