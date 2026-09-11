import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStaticWorldCupContentDto } from './create-static-world-cup-content.dto.js';

describe('CreateStaticWorldCupContentDto', () => {
  it('trims and accepts a valid image candidate request', async () => {
    const request = plainToInstance(CreateStaticWorldCupContentDto, {
      contentsName: '  후보 A  ',
      visibleType: 'PUBLIC',
    });

    await expect(validate(request)).resolves.toEqual([]);
    expect(request.contentsName).toBe('후보 A');
  });

  it('rejects an empty name and unsupported visibility', async () => {
    const request = plainToInstance(CreateStaticWorldCupContentDto, {
      contentsName: '   ',
      visibleType: 'HIDDEN',
    });

    const errors = await validate(request);

    expect(errors.map(({ property }) => property)).toEqual([
      'contentsName',
      'visibleType',
    ]);
  });
});
