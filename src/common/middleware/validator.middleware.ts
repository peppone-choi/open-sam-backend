import { Request, Response, NextFunction } from 'express';
import { HttpException } from '../errors/HttpException';

// TODO: yup 설치 및 임포트
// import { AnyObjectSchema } from 'yup';

/**
 * Yup 기반 검증 미들웨어
 * 
 * 사용 예시:
 * router.post('/', validate(SubmitCommandSchema), controller.submit)
 * 
 * TODO: 
 * 1. npm install yup
 * 2. npm install --save-dev @types/yup
 */
export const validate = (schema: {
  body?: any; // TODO: AnyObjectSchema
  params?: any; // TODO: AnyObjectSchema
  query?: any; // TODO: AnyObjectSchema
}) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      // TODO: Yup 검증 로직 구현
      // if (schema.body) {
      //   req.body = await schema.body.validate(req.body, { 
      //     abortEarly: false, 
      //     stripUnknown: true 
      //   });
      // }
      // if (schema.params) {
      //   req.params = await schema.params.validate(req.params);
      // }
      // if (schema.query) {
      //   req.query = await schema.query.validate(req.query);
      // }
      
      next();
    } catch (error: any) {
      // TODO: Yup 에러를 HttpException으로 변환
      next(new HttpException(400, 'Validation Error', error.errors));
    }
  };
};
