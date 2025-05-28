/* eslint-disable no-useless-escape */
import type { Department } from './../types';
import puppeteer, { Browser, Page } from 'puppeteer'
import fs from 'fs'
import pLimit from 'p-limit';
const limit = pLimit(2); // max 20 concurrent tasks



export default class Bot  {
  private browser:Browser | null = null

  constructor () { }
  async init (): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless:false,
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
          fs.mkdirSync(key) // create directory for each district

          for (let j = 0; j < list.length; j++) {
            const item = list[j];
            const profileLinks = await this.getProfileLinks(item.link)
            console.table([{  Index: j, district: key, total:profileLinks.length,  department: item.name}]);

            const fileId =`${key}/${j}-${item.name.replace(/[\/ ]/g, '-')}-doctors`
            const tasks = profileLinks.map((d) => limit(() => this.getDoctorProfileDetails(d, key, fileId )));
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


  async  getDoctorProfileDetails(profileLink:string, district:string, fileId:string){
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
      await page.close();
      return doctorData;
    } catch{
      console.error({ link:profileLink, district, fileId });
      const prevErrors = JSON.parse(fs.readFileSync('errorLinks.json', 'utf-8'));
      prevErrors.errorLinks.push({ link:profileLink, district, fileId });
      fs.writeFileSync('errorLinks.json', JSON.stringify(prevErrors, null, 2));
      page?.close();
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


  async wait(ms:number){
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }
}