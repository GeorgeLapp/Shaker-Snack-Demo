import { AbstractApiModule } from '../../abstractApiModule';
import { ProductMatrixDTO } from '../../../../types/serverInterface/ProductMatrixDTO';
import { StartSaleDTO, StartSaleRes } from '../../../../types/serverInterface/StartSaleDTO';
import {
  IssueProductDTO,
  IssueProductRes,
} from '../../../../types/serverInterface/IssueProductDTO';
import { buildSnackMediaUrl } from '../../../../helpers/media';

const ENDPOINTS = {
  productMatrix: '/api/product-matrix',
  startSale: '/api/start-sale',
  issueProduct: '/api/issue-product',
  cancelSale: '/api/cancel-sale',
} as const;

type ProductMatrixOptions = {
  cacheBust?: string | number;
};

export class ClientModule extends AbstractApiModule {
  getProductMatrix(options?: ProductMatrixOptions): Promise<ProductMatrixDTO> {
    const cacheBust = options?.cacheBust;
    const params =
      cacheBust === undefined || cacheBust === null ? undefined : { _: cacheBust };

    return this.request
      .get<typeof params, ProductMatrixDTO>(ENDPOINTS.productMatrix, params)
      .then((matrix) =>
        matrix.map((item) => ({
          ...item,
          imgPath: buildSnackMediaUrl(item.imgPath, cacheBust),
        })),
      );
  }

  startSale(startSaleData: StartSaleDTO): Promise<StartSaleRes> {
    return this.request.post<StartSaleDTO, StartSaleRes>(ENDPOINTS.startSale, startSaleData);
  }

  issueProduct(issueProductData: IssueProductDTO): Promise<IssueProductRes> {
    return this.request.post<IssueProductDTO, IssueProductRes>(
      ENDPOINTS.issueProduct,
      issueProductData,
    );
  }

  cancelSale(cancelSaleData: StartSaleDTO): Promise<StartSaleRes> {
    return this.request.post<StartSaleDTO, StartSaleRes>(ENDPOINTS.cancelSale, cancelSaleData);
  }
}
