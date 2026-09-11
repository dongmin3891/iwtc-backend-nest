import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';
import { ObjectStorageService } from './object-storage.service.js';

describe('ObjectStorageService', () => {
  it('uploads an object to the configured bucket with its content type', async () => {
    const send = vi.fn().mockResolvedValue({});
    const config = {
      getOrThrow: vi.fn().mockReturnValue('iwtc'),
    } as unknown as ConfigService;
    const service = new ObjectStorageService({ send }, config);
    const body = new Uint8Array([1, 2, 3]);

    await expect(
      service.putObject({
        key: 'candidates/1/image.png',
        body,
        contentType: 'image/png',
      }),
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledOnce();
    const command = send.mock.calls[0]![0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'iwtc',
      Key: 'candidates/1/image.png',
      Body: body,
      ContentType: 'image/png',
    });
  });

  it('propagates an object storage failure', async () => {
    const storageError = new Error('object storage unavailable');
    const service = new ObjectStorageService(
      { send: vi.fn().mockRejectedValue(storageError) },
      {
        getOrThrow: vi.fn().mockReturnValue('iwtc'),
      } as unknown as ConfigService,
    );

    await expect(
      service.putObject({
        key: 'candidates/1/image.png',
        body: new Uint8Array([1]),
        contentType: 'image/png',
      }),
    ).rejects.toBe(storageError);
  });

  it('deletes an object from the configured bucket', async () => {
    const send = vi.fn().mockResolvedValue({});
    const service = new ObjectStorageService({ send }, {
      getOrThrow: vi.fn().mockReturnValue('iwtc'),
    } as unknown as ConfigService);

    await expect(
      service.deleteObject('world-cups/3/candidates/image.png'),
    ).resolves.toBeUndefined();

    const command = send.mock.calls[0]![0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'iwtc',
      Key: 'world-cups/3/candidates/image.png',
    });
  });
});
