import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig, AxiosError } from 'axios';
import { api } from './index';

type ApiError = {
  code: string;
  message: string;
  key: string;
};

export class AxiosCoreApi {
  private readonly _apiConfig: AxiosRequestConfig;
  private _axiosInstance: AxiosInstance;
  private _accessToken: string | null = null;

  constructor(apiConfig?: AxiosRequestConfig) {
    this._apiConfig = apiConfig || {};
    this._axiosInstance = axios.create(apiConfig);

    // this.readAccessToken();

    this.extractData = this.extractData.bind(this);

    this._axiosInstance.interceptors.request.use(
      (config) => {
        if (this._accessToken) config.headers.Authorization = `Bearer ${this._accessToken}`;
        return config;
      },

      // CORS error
      (error) => {
        console.log('cors, ', error);
        return { ...error, code: 'CORS' };
      },
    );

    this._axiosInstance.interceptors.response.use(
      (data) => {
        return data;
      },
      (error): Promise<ApiError> => {
        console.log('error, ', error.response.data.message);

        if (error.response.status === 401) {
          api.clearTokens();
          location.reload();
        }

        return Promise.reject({
          ...error,
          code: String(error.response.status),
          message: String(error.response.data.key || error.response.data.message),
        });
      },
    );
  }

  public get accessToken() {
    return this._accessToken;
  }

  public set accessToken(value: string | null) {
    this._accessToken = value;
    // this.saveAccessToken(value);
  }

  public get<
    Req extends Record<string, unknown> | unknown = unknown,
    Res extends Record<string, unknown> | any[] | void = void,
  >(url: string, params?: Req): Promise<Res> {
    return this._axiosInstance.get<Res>(url, { params }).then(this.extractData);
  }

  public post<
    Req extends Record<string, unknown> | unknown = unknown,
    Res extends Record<string, unknown> | string | any[] | void = void,
  >(url: string, data?: Req, config?: AxiosRequestConfig): Promise<Res> {
    return this._axiosInstance.post<Res>(url, data, config).then(this.extractData);
  }

  public put<Req extends Record<string, unknown> | unknown = unknown, Res = void>(
    url: string,
    data?: Req,
  ): Promise<Res> {
    return this._axiosInstance.put<Res>(url, data).then(this.extractData);
  }

  public patch<
    Req extends Record<string, unknown> | unknown = unknown,
    Res extends Record<string, unknown> | void = void,
  >(url: string, data?: Req): Promise<Res> {
    return this._axiosInstance.patch<Res>(url, data).then(this.extractData);
  }

  public delete<Res extends Record<string, unknown> | void = void>(url: string): Promise<Res> {
    return this._axiosInstance.delete<Res>(url).then(this.extractData);
  }

  private extractData<T>(response: AxiosResponse<T>): T {
    return response.data;
  }

  // private readAccessToken(): boolean {
  //   this._accessToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_NAME) || null;
  //   return Boolean(this._accessToken);
  // }
  //
  // private saveAccessToken(token: string | null): void {
  //   if (!token) return localStorage.removeItem(ACCESS_TOKEN_STORAGE_NAME);
  //   localStorage.setItem(ACCESS_TOKEN_STORAGE_NAME, token);
  // }
}
