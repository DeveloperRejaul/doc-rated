export type Department = Record<string, {id:string, name:string, link:string}[]> 

export type Doctor = Record<string, { id:string, departmentId:string, name:string, degree:string, specialty:string, workplace:string, info:string,chamber: {hospital:string, address:string,visitingTime:string,appointmentNumber:string }}[]>
