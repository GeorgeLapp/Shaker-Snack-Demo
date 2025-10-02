import { AxiosCoreApi } from './axiosCore';
import { ClientModule } from './modules/cleint/clientModule';

export class Api {
  private readonly request: AxiosCoreApi;

  public readonly client: ClientModule;

  constructor() {
    this.request = new AxiosCoreApi();

    this.client = new ClientModule(this.request);
  }

  clearTokens(): void {
    this.request.accessToken = null;
  }

  saveToken(token: string): void {
    this.request.accessToken = token;
  }
}

export const api = new Api();
