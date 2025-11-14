import { AxiosCoreApi } from './axiosCore';
import { ClientModule } from './modules/cleint/clientModule';

const SNACK_API_BASE_URL = import.meta.env.VITE_APP_SNACK_API_URL ?? 'http://localhost:4000';

export class Api {
  private readonly request: AxiosCoreApi;

  public readonly client: ClientModule;

  constructor() {
    this.request = new AxiosCoreApi({
      baseURL: SNACK_API_BASE_URL,
    });

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
