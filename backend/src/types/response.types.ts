
export interface ISuccessResponse<T> {
  success: true;       
  message: string;    
  data?: T;           
}

export interface IErrorResponse {
  success: false;
  message: string;    
  errors?: any;       
  stack?: string;     
}