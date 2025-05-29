/* eslint-disable no-useless-escape */
import type { Department, Doctor } from './../types';
import puppeteer, { Browser, Page } from 'puppeteer'
import fs from 'fs'
import pFs from 'fs/promises';
import pLimit from 'p-limit';
import path from 'path';
const limit = pLimit(2); // max 20 concurrent tasks



export default class Bot  {
  private browser:Browser | null = null

  constructor () { }
  async init (): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless:true,
        defaultViewport: null,
      });
    } catch (error) {
      console.log(error);
    }
  }

  async getDepartmentList (district: string[]){
    try {

      if(!this.browser) {
        return console.error('Browser is not initialized');
      }

      const departmentsList:Department= {}
      for (const element of district) {
        const page = await this.browser.newPage();
  
        // Load HTML using data URI
        await page.goto(`https://www.doctorbangladesh.com/doctors-${element}/`, { waitUntil: 'domcontentloaded' , });
  
  
        // Extract department data
        const departments = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.entry-content ul.list li a'));
          return items.map((item) => ({
            link: item.getAttribute('href') || '',
            name:item.innerHTML
          }));
        });
        departmentsList[element] = departments.map((item)=>({...item, id: this.generateUUIDv4()}));
        await page.close();
      }

      // Optionally, save to a JSON file
      fs.writeFileSync('departments.json', JSON.stringify({ department:  departmentsList }, null, 2))

      this.browser.close();
    } catch (error) {
      console.log(error);
      this?.browser?.close();
    }
  }


  async getDoctorList (params: Department) {
    try {
      if(!this.browser) {
        return console.error('Browser is not initialized');
      }
  
      for (const key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) {

          // select district of department
          const list = params[key];
          if (!fs.existsSync('doc-list')) {
            fs.mkdirSync('doc-list'); // create root directory
          }
          if (!fs.existsSync(path.join('doc-list', key))) {
            fs.mkdirSync(path.join('doc-list', key))
          }
          

          for (let j = 0; j < list.length; j++) {
            const item = list[j];
            const profileLinks = await this.getProfileLinks(item.link)
            console.table([{  Index: j, district: key, total:profileLinks.length,  department: item.name}]);

            const fileId =`doc-list/${key}/${j}-${item.name.replace(/[\/ ]/g, '-')}-doctors`
            const tasks = profileLinks.map((d) => limit(() => this.getDoctorProfileDetails(d, key, fileId , item.id)));
            const docLists = await Promise.allSettled(tasks);
            const fulfilledValues = docLists.filter(result => result.status === 'fulfilled').map(result => result.value);
            fs.writeFileSync(`${fileId}.json`, JSON.stringify({ doctor: fulfilledValues}, null, 2))
          }
        }
      }
      this.browser.close();
    } catch (error) {
      console.log(error);
      this?.browser?.close();
    }
  }


  async getProfileLinks (link: string):Promise<string[]> {
    try {
      if(!this.browser){
        console.error('Browser is not initialized');
        return[] 
      }
      const page = await this.browser.newPage();
      await page.goto(link, { waitUntil: 'domcontentloaded' , });
  
      // all doctor list link in per department
      const profileLinks = await page.$$eval('.doctors .doctor .photo a', anchors => anchors.map(a => a.href));
      await page.close();
      return profileLinks;
    } catch (error) {
      console.log("error", error);
      return[]
    }
  }


  async  getDoctorProfileDetails(profileLink:string, district:string, fileId:string, departmentId:string){
    if(!this.browser){
      console.error('Browser is not initialized');
      return
    }
    let page:Page | null = null;
    try {
      page = await this.browser.newPage();
      await page.goto(profileLink, { waitUntil: 'domcontentloaded' });
      const doctorData = await page.evaluate(() => {
        const name = document.querySelector('.entry-header .info .entry-title')?.textContent?.trim() || '';
        const degree = document.querySelector('.entry-header .info ul li[title="Degree"]')?.textContent?.trim() || '';
        const specialty = document.querySelector('.entry-header .info ul li[title="Specialty"]')?.textContent?.trim() || ''; 
        const workplace = document.querySelector('.entry-header .info ul li[title="Workplace"]')?.textContent?.trim() || ''; 
        const allPTag = document.querySelectorAll('.entry-content p');
        const info = allPTag[1]?.textContent?.trim() || '';
  
        const hospitalName = document.querySelector('.entry-content p strong a')?.textContent?.trim() || '';
        const allContent = document.querySelector('.entry-content p')?.textContent?.trim() || '';
  
        // Address
        const addressStartIndex = allContent.indexOf('Address:')
        const addressEndIndex = allContent.indexOf('Visiting Hour:')
        const address = allContent.slice(addressStartIndex,addressEndIndex).replace('Address:', '').trim() || '';
  
        // visitingTime
        const visitingTimeEndIndex= allContent.indexOf('Appointment:') 
        const visitingTime = allContent.slice(addressEndIndex,visitingTimeEndIndex).replace("Visiting Hour:", '').trim() || '';
  
        // appointmentNumber
        const appointmentNumber = allContent.slice(visitingTimeEndIndex).replace('Appointment:', '').trim() || '';
        return { name, degree, specialty, workplace, info, chamber:{hospital:hospitalName, address, visitingTime, appointmentNumber} };
      });
      
      const imageId = await this.downloadProfileImage(page, profileLink);
      
      await page.close();
      return {id: this.generateUUIDv4(), departmentId, link: profileLink,imageId, ...doctorData};
    } catch{
      const data = await pFs.readFile('errorLinks.json', 'utf-8');
      const prevErrors = JSON.parse(data);
      prevErrors.errors.push({ link:profileLink, district, fileId });
      await pFs.writeFile('errorLinks.json', JSON.stringify(prevErrors, null, 2));
      console.error({ link:profileLink, district, fileId });
      await page?.close();
    }
  } 

  // Utils
  generateUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async downloadProfileImage (page:Page, profileLink:string): Promise<string> {
    const imageId = this.generateUUIDv4();
    try {
      const {base64, ext} = await page.evaluate(async (): Promise<{ base64:string, ext:string}> => {
        const img = document.querySelector('.entry-header div.photo img.attachment-full') as HTMLImageElement | null;
        if (!img) throw new Error('Image element not found');

        if (!img.complete || img.naturalWidth === 0) {
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load captcha image'));
          });
        }

        const response = await fetch(img.src);
        const blob = await response.blob();
        const contentType = blob.type; // e.g., "image/png"

        const base64 =  await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const ext = contentType.split('/').pop() || 'jpg';
        return { base64, ext };
      });

      // Extract base64 data and save it to a file
      const base64Data = base64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      if(!fs.existsSync('images')) {
        await pFs.mkdir('images');
      }
      await pFs.writeFile(path.join("images",`${imageId}.${ext}`), base64Data, 'base64');
      return imageId;
    } catch {
      console.error("Failed to download profile image");
      const data  = await pFs.readFile('imageError.json', 'utf-8')
      const prevErrors = JSON.parse(data);
      prevErrors.errors.push({ imageId, link: profileLink});
      await pFs.writeFile('imageError.json', JSON.stringify(prevErrors, null, 2));
      await page?.close();
      return imageId;
    }
  }

  getTotalDoctorsCount () {
    const docRootPath= process.cwd() + '/doc-list'
    const allDistrictList = fs.readdirSync(docRootPath);
    let total:number = 0;
    for (const district of allDistrictList) {
      const files = fs.readdirSync(`${docRootPath}/${district}`);
      files.forEach(file=>{
        const docs = JSON.parse(fs.readFileSync(path.join(docRootPath, district,file), 'utf-8'));
        total+=docs.doctor.length
      })
    }
    return total;
  }

  modifyAllDoc(cv:(doc:Doctor)=>Record<string, string>) {
    const docRootPath= process.cwd() + '/doc-list'
    const allDistrictList = fs.readdirSync(docRootPath);
    for (const district of allDistrictList) {
      const files = fs.readdirSync(`${docRootPath}/${district}`);
      files.forEach(file=>{
        const docs = JSON.parse(fs.readFileSync(path.join(docRootPath, district,file), 'utf-8'));
        const modifyDoc = docs.doctor.map((doc:Doctor) => ({...doc, ...cv(doc)}));
        fs.writeFileSync(path.join(docRootPath, district,file), JSON.stringify({ doctor: modifyDoc }, null, 2));
      })
    }
  }

  async wait(ms:number){
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }
}