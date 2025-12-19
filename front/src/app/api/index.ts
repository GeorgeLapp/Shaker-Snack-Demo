import { AxiosCoreApi } from './axiosCore';
import ClientModule from './modules/client';
import ServiceMenuModule from './modules/serviceMenu';

const SNACK_API_BASE_URL = import.meta.env.VITE_APP_SNACK_API_URL ?? 'http://localhost:4000';

export class Api {
  private readonly request: AxiosCoreApi;

  public readonly client: ClientModule;
  public readonly serviceMenu: ServiceMenuModule;

  constructor() {
    this.request = new AxiosCoreApi({
      baseURL: SNACK_API_BASE_URL,
    });

    this.client = new ClientModule(this.request);
    this.serviceMenu = new ServiceMenuModule(this.request);
  }

  clearTokens(): void {
    this.request.accessToken = null;
  }

  saveToken(token: string): void {
    this.request.accessToken = token;
  }
}

export const api = new Api();
