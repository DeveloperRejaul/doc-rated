import { LaunchOptions } from "puppeteer"

export type Department = Record<string, {
    id:string,
    name:string, 
    link:string
}[]> 

export type Doctor = Record<string, { 
    id:string,
    link:string,
    departmentId:string,
    name:string,
    degree:string,
    specialty:string, 
    workplace:string, 
    info:string,
    chamber: {
        hospital:string, 
        address:string,
        visitingTime:string,
        appointmentNumber:string 
    }
}[]>


export interface IDoctor {
    id:string,
    link:string,
    departmentId:string,
    name:string,
    degree:string,
    specialty:string, 
    workplace:string, 
    info:string,
    chamber: {
        hospital:string, 
        address:string,
        visitingTime:string,
        appointmentNumber:string 
    }
    imageId:string;
}

export interface IBotInitOptions  extends LaunchOptions{
    limitPage?:number,
}

export interface IImageErrorOptions {
errorFileNameFroRead:string,
errorFileNameFroWrite:string
}