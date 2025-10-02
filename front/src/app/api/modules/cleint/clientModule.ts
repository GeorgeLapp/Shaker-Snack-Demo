import { AbstractApiModule } from '../../abstractApiModule';
import { ProductMatrixDTO } from '../../../../types/serverInterface/ProductMatrixDTO';
import { StartSaleDTO, StartSaleRes } from '../../../../types/serverInterface/StartSaleDTO';
import { IssueProductDTO, IssueProductRes } from '../../../../types/serverInterface/IssueProductDTO';
import { buildSnackMediaUrl } from '../../../../helpers/media';

const ENDPOINTS = {
  productMatrix: '/api/product-matrix',
  startSale: '/api/start-sale',
  issueProduct: '/api/issue-product',
} as const;

export class ClientModule extends AbstractApiModule {
  getProductMatrix(): Promise<ProductMatrixDTO> {
    return this.request
      .get<undefined, ProductMatrixDTO>(ENDPOINTS.productMatrix)
      .then((matrix) =>
        matrix.map((item) => ({
          ...item,
          imgPath: buildSnackMediaUrl(item.imgPath),
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
}
