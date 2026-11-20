
export interface ISuccessResponse<T> {
  success: true;       
  message: string;    
  data?: T;           
}

export interface IErrorResponse {
  success: false;
  message: string;    
  code?: string | undefined;
  data?: any;
  errors?: any;       
  stack?: string | undefined;     
}