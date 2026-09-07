import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClearWorldCupDto } from './clear-world-cup.dto.js';

const PLAY_ID = '550e8400-e29b-41d4-a716-446655440000';

async function validationProperties(value: unknown): Promise<string[]> {
  const dto = plainToInstance(ClearWorldCupDto, value);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors.map((error) => error.property);
}

describe('ClearWorldCupDto', () => {
  it('accepts first and second place for a final-only game', async () => {
    await expect(
      validationProperties({
        playId: PLAY_ID,
        round: 2,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 2, rank: 2 },
        ],
      }),
    ).resolves.toEqual([]);
  });

  it('accepts first through fourth place for larger games', async () => {
    await expect(
      validationProperties({
        playId: PLAY_ID,
        round: 16,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 2, rank: 2 },
          { contentsId: 3, rank: 3 },
          { contentsId: 4, rank: 4 },
        ],
      }),
    ).resolves.toEqual([]);
  });

  it('rejects an invalid play id', async () => {
    await expect(
      validationProperties({
        playId: 'not-a-uuid',
        round: 2,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 2, rank: 2 },
        ],
      }),
    ).resolves.toContain('playId');
  });

  it('rejects an unsupported round', async () => {
    await expect(
      validationProperties({
        playId: PLAY_ID,
        round: 3,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 2, rank: 2 },
        ],
      }),
    ).resolves.toContain('round');
  });

  it('requires only first and second place for round 2', async () => {
    await expect(
      validationProperties({
        playId: PLAY_ID,
        round: 2,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 2, rank: 2 },
          { contentsId: 3, rank: 3 },
          { contentsId: 4, rank: 4 },
        ],
      }),
    ).resolves.toContain('placements');
  });

  it('requires first through fourth place for larger games', async () => {
    await expect(
      validationProperties({
        playId: PLAY_ID,
        round: 4,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 2, rank: 2 },
        ],
      }),
    ).resolves.toContain('placements');
  });

  it('rejects duplicate candidates and ranks', async () => {
    await expect(
      validationProperties({
        playId: PLAY_ID,
        round: 4,
        placements: [
          { contentsId: 1, rank: 1 },
          { contentsId: 1, rank: 2 },
          { contentsId: 3, rank: 2 },
          { contentsId: 4, rank: 4 },
        ],
      }),
    ).resolves.toContain('placements');
  });

  it('rejects invalid nested placement fields', async () => {
    await expect(
      validationProperties({
        playId: PLAY_ID,
        round: 2,
        placements: [
          { contentsId: 0, rank: 1 },
          { contentsId: 2, rank: 5 },
        ],
      }),
    ).resolves.toContain('placements');
  });
});
