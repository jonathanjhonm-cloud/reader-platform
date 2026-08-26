import { BadGatewayException, Injectable } from '@nestjs/common';
import { GoogleService } from '../auth/google.service';

@Injectable()
export class DriveService {
  constructor(private readonly google: GoogleService) {}

  async listReadingFiles(userId: string, pageToken?: string) {
    const accessToken = await this.google.getAccessToken(userId);
    const query = new URLSearchParams({
      q: "trashed = false and (mimeType = 'application/pdf' or mimeType = 'application/epub+zip')",
      pageSize: '50', orderBy: 'modifiedTime desc',
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,iconLink)',
    });
    if (pageToken) query.set('pageToken', pageToken);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new BadGatewayException('Não foi possível listar os arquivos do Google Drive');
    return response.json();
  }

  async downloadFile(userId: string, fileId: string) {
    const accessToken = await this.google.getAccessToken(userId);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new BadGatewayException('Não foi possível baixar este arquivo do Google Drive');
    return { contentType: response.headers.get('content-type') ?? 'application/octet-stream', data: Buffer.from(await response.arrayBuffer()) };
  }
}
