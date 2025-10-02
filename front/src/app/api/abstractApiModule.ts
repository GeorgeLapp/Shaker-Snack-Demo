import { AxiosCoreApi } from './axiosCore';

export abstract class AbstractApiModule {
  protected readonly request: AxiosCoreApi;
  constructor(request: AxiosCoreApi) {
    this.request = request;
  }
}
