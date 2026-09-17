import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAutomationStaticWorldCupContentDto } from './create-automation-static-world-cup-content.dto.js';

function validRequest(overrides: Record<string, unknown> = {}) {
  return {
    contentsName: '후보 A',
    visibleType: 'PUBLIC',
    sourceProvider: 'PEXELS',
    sourceExternalId: '4731094',
    sourceUrl: 'https://www.pexels.com/photo/example-4731094/',
    sourceAuthor: 'Helena Lopes',
    sourceAuthorUrl: 'https://www.pexels.com/@helenalopes',
    ...overrides,
  };
}

async function validateRequest(overrides: Record<string, unknown> = {}) {
  const dto = plainToInstance(
    CreateAutomationStaticWorldCupContentDto,
    validRequest(overrides),
  );
  return { dto, errors: await validate(dto) };
}

describe('CreateAutomationStaticWorldCupContentDto', () => {
  it('accepts and trims Pexels photo and author URLs', async () => {
    const { dto, errors } = await validateRequest({
      sourceUrl: '  https://www.pexels.com/photo/example-4731094/  ',
      sourceAuthorUrl: '  https://www.pexels.com/@helenalopes  ',
    });

    expect(errors).toHaveLength(0);
    expect(dto.sourceUrl).toBe('https://www.pexels.com/photo/example-4731094/');
    expect(dto.sourceAuthorUrl).toBe('https://www.pexels.com/@helenalopes');
  });

  it.each([
    ['another host', 'https://example.com/photo/example-4731094/'],
    ['an HTTP URL', 'http://www.pexels.com/photo/example-4731094/'],
    ['a non-photo Pexels path', 'https://www.pexels.com/search/dog/'],
    ['a URL with user info', 'https://pexels.com@example.com/photo/4731094/'],
  ])('rejects sourceUrl using %s', async (_label, sourceUrl) => {
    const { errors } = await validateRequest({ sourceUrl });

    expect(errors).not.toHaveLength(0);
  });

  it.each([
    ['another host', 'https://example.com/@helenalopes'],
    ['an HTTP URL', 'http://www.pexels.com/@helenalopes'],
    ['a non-author Pexels path', 'https://www.pexels.com/photo/4731094/'],
    ['an empty author slug', 'https://www.pexels.com/@'],
  ])('rejects sourceAuthorUrl using %s', async (_label, sourceAuthorUrl) => {
    const { errors } = await validateRequest({ sourceAuthorUrl });

    expect(errors).not.toHaveLength(0);
  });
});
