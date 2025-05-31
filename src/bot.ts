 
import type { Department, Doctor, IBotInitOptions, IDoctor, IImageErrorOptions } from './../types';
import puppeteer, { Browser, Page } from 'puppeteer'
import fs from 'fs'
import pFs from 'fs/promises';
import pLimit, { LimitFunction } from 'p-limit';
import * as path from 'path';

export default class Bot  {
  private browser:Browser | null = null
  private limit:LimitFunction = pLimit(2);;

  constructor () { }


  async init ({limitPage, ...extra}:IBotInitOptions): Promise<Browser> {
    try {
      this.browser = await puppeteer.launch({
        headless:false,
        defaultViewport: null,
        ...extra
      });
      if(limitPage){
        this.limit = pLimit(limitPage)
      }
      return this.browser;
    } catch (error) {
      console.log(error);
      process.exit(1);
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
        await page.goto(`https://www.doctorbangladesh.com/doctors-${element}/`, { waitUntil: 'domcontentloaded'});
  
  
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


  async getDoctorList (params: Department, options?:{checkUnique?:boolean, doctors:IDoctor[]}) {
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
            let profileLinks =  await this.getProfileLinks(item.link)

            // check unique doctor link
            if(options?.checkUnique) profileLinks = profileLinks.filter(link =>!options.doctors.some(doc => doc.link === link));

            
            console.table([{  Index: j, district: key, total:profileLinks.length,  department: item.name}]);

            // eslint-disable-next-line no-useless-escape
            const fileId =`doc-list/${key}/${j}-${item.name.replace(/[\/ ]/g, '-')}-doctors`

            const tasks = profileLinks.map((d) =>  this.limit(() => this.getDoctorProfileDetails(d, key, fileId , item.id)))
            const docLists = await Promise.allSettled(tasks);
            const fulfilledValues = docLists.filter(result => result.status === 'fulfilled').map(result => result.value);
            if(fulfilledValues.length > 0
            ) fs.writeFileSync(`${fileId}.json`, JSON.stringify({ doctor: fulfilledValues}, null, 2))
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
    let page:Page | null = null;
    try {
      if(!this.browser){
        console.error('Browser is not initialized');
        return[] 
      }
      page = await this.browser.newPage();
      await this.blockResources(page);
      await page.goto(link, { waitUntil: 'domcontentloaded' , });
  
      // all doctor list link in per department
      const profileLinks = await page.$$eval('.doctors .doctor .photo a, .doctor .photo a', anchors => anchors.map(a => a.href));
      await page.close();
      return profileLinks;
    } catch (error) {
      console.log("error", error);
      await page?.close();
      return []
    }
  }


  async getDoctorProfileDetails(profileLink:string, district:string, fileId:string, departmentId:string){
    if(!this.browser){
      console.error('Browser is not initialized');
      return
    }
    let page:Page | null = null;
    try {
      page = await this.browser.newPage();
      await this.blockResources(page, {blocked:['stylesheet','font','script','media']});
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
        const appointmentNumber = allContent.slice(visitingTimeEndIndex).replace('Appointment:', '').trim().replace("Call Now", "") || '';
        return { name, degree, specialty, workplace, info, chamber:{hospital:hospitalName, address, visitingTime, appointmentNumber} };
      });
      
      const imageId = await this.downloadProfileImage(page, profileLink);
      
      await page.close();
      return {id: this.generateUUIDv4(), departmentId, link: profileLink,imageId, ...doctorData};
    } catch{
      const data = await pFs.readFile('errorLinks.json', 'utf-8');
      const prevErrors = JSON.parse(data);
      prevErrors.errors.push({ link:profileLink, district, fileId ,departmentId});
      await pFs.writeFile('errorLinks.json', JSON.stringify(prevErrors, null, 2));
      console.error({ link:profileLink, district, fileId,departmentId });
      await page?.close();
    }
  } 

  async downloadProfileImage (page:Page, profileLink:string, id?:string, errorFileName?:string): Promise<string> {
    const imageId = id || this.generateUUIDv4();
    const eFileName = errorFileName || "imageError";
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
      
      if(!fs.existsSync(`${eFileName}.json`)) {
        console.log(`${errorFileName} file not found, creating a new one`);
        await pFs.writeFile(`${eFileName}.json`, JSON.stringify({errors:[]}, null, 2));
      }

      const data  = await pFs.readFile(`${eFileName}.json`, 'utf-8')
      const prevErrors = JSON.parse(data);
      prevErrors.errors.push({ imageId, link: profileLink});
      await pFs.writeFile(`${eFileName}.json`, JSON.stringify(prevErrors, null, 2));
      await page?.close();
      return imageId;
    }
  }

  async wait(ms:number){
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms);
    });
  }

  async handleLinkErrors () {
    try {
      if(!this.browser){
        return console.log('please init ')
      }
      const linkErrors = await pFs.readFile('errorLinks.json', 'utf-8');
      const linkErrorsData = JSON.parse(linkErrors);
      // handle Links errors
      if(linkErrorsData.errors.length > 0) {
        for (let i = 0; i < linkErrorsData.errors.length; i++) {
          const errorObj = linkErrorsData.errors.pop();
          const docList = await pFs.readFile(`${errorObj.fileId}.json`, 'utf-8');
          const docListData = JSON.parse(docList);
          const data =  await this.getDoctorProfileDetails(errorObj.link, errorObj.district, this.generateUUIDv4(),  errorObj.departmentId)
          docListData.doctor = [...docListData.doctor, data]
          await pFs.writeFile(`${errorObj.fileId}.json`, JSON.stringify(docListData,  null, 2), 'utf-8');
        }
        await pFs.writeFile('errorLinks.json', JSON.stringify(linkErrorsData,  null, 2), 'utf-8');
        await this.browser.close()
      }
      // handleImage errors
    } catch (error) {
      console.log(error);
      
    }
  }

  async handleImageError (params: IImageErrorOptions) {
    const {errorFileNameFroRead = "imageError",errorFileNameFroWrite} = params || {};
    try {
      if(!this.browser){
        return console.log('please init ')
      }

      if(!fs.existsSync(`${errorFileNameFroRead}.json`)) {
        console.log('No image errors found');
        return;
      }

      const filePath = path.join(process.cwd(), `${errorFileNameFroWrite}.json`);

      if(!fs.existsSync(filePath)) { 
        await pFs.writeFile(filePath, JSON.stringify({errors:[]}, null , 2));
      }

      const imageErrors = await pFs.readFile(path.join(process.cwd(),`${errorFileNameFroRead}.json`), 'utf-8');
      const imageErrorsData = JSON.parse(imageErrors);
      const len = imageErrorsData.errors.length-1

      for (let index = len;  0 <= index; --index) {
        const errorObj = imageErrorsData.errors.pop()
        const page = await this.browser.newPage()
        await this.blockResources(page, {blocked:['stylesheet','font','script','media']});

        // Log the error object
        console.table([{Index: index, link: errorObj.link, imageId: errorObj.imageId }]);
        
        await page.goto(errorObj.link, { waitUntil: 'domcontentloaded'});
        await this.downloadProfileImage(page, errorObj.link,errorObj.imageId, errorFileNameFroWrite)
      }
      await pFs.writeFile(path.join(process.cwd(),`${errorFileNameFroRead || 'imageError'}.json`), JSON.stringify(imageErrorsData,  null, 2), 'utf-8');
      await this.browser.close()
    } catch (error) {
      console.log(error);
    }
  }

  async makeSingleDocFile(cv?:(doc:Doctor)=>Record<string, string>, saveFileName?:string) {
    const docRootPath= process.cwd() + '/doc-list'
    const allDistrictList = fs.readdirSync(docRootPath);
    const allDoctors:Doctor[] =[]
    for (const district of allDistrictList) {
      const files = fs.readdirSync(`${docRootPath}/${district}`);
      files.forEach(file=>{
        const docs = JSON.parse(fs.readFileSync(path.join(docRootPath, district,file), 'utf-8'));
        const newDocs = docs.doctor.map((doc:Doctor) => ({...doc, ...cv?.(doc)}))
        allDoctors.push(...newDocs)
      })
    }
    await pFs.writeFile(saveFileName || `doctors-${Date.now()}.json`, JSON.stringify({ doctor: allDoctors }, null, 2),  'utf-8');
  }

  async combineAllDoc (paths:string[], saveFileName?:string) {
    try {
      const allDoc :Doctor[] = [];
      for (const filePath of paths) {
        const mainPath = path.join(process.cwd(), filePath);
        if (!fs.existsSync(mainPath)) {
          console.error(`File not found: ${mainPath}`);
          continue;
        }
        const data = await pFs.readFile(mainPath, 'utf-8');
        const jsonData = JSON.parse(data);
        allDoc.push(...jsonData.doctor);
      }
  
      // Save combined data to a new file
      const outputFilePath = saveFileName || `combined-doctors-${Date.now()}.json`;
      await pFs.writeFile(outputFilePath, JSON.stringify({ doctor: allDoc }, null, 2), 'utf-8');
      console.log(`Combined data saved to ${outputFilePath}`);
      return outputFilePath;
    } catch (error) {
      console.log(error);
      
    }
  }

  async blockResources (page:Page, options?:{blocked:string[]}) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const blocked = options?.blocked ||[
        'image',
        'stylesheet',
        'font',
        'script',
        'media',
        'xhr',
        'fetch'
      ];
      if (blocked.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  };

  async downloadAllImagesFromDocList (doctor:IDoctor[], errorFile?:string) {
    try {

      const tasks = doctor.map((doc:IDoctor, index) => this.limit(async () => {
        if(!this.browser){
          return console.error('Browser is not initialized');
        }
        let page:Page | null = null;
        try {
          page = await this.browser.newPage();
          await this.blockResources(page, {blocked:['stylesheet','font','script','media']});
          console.table([{index,  link: doc.link, imageId: doc.imageId }]);
          await page.goto(doc.link, { waitUntil: 'domcontentloaded' });
          await this.downloadProfileImage(page, doc.link, doc.imageId, errorFile);
          await page.close()
        } catch {
          await page?.close();
          const data  = await pFs.readFile(`${errorFile || "imageError"}.json`, 'utf-8')
          const prevErrors = JSON.parse(data);
          prevErrors.errors.push({ imageId:doc.imageId, link: doc.link});
          await pFs.writeFile(`${errorFile || "imageError"}.json`, JSON.stringify(prevErrors, null, 2));
          console.log(`Error downloading image for doctor at index ${index}`);
        }
      }));

      await Promise.allSettled(tasks);
      await this.browser?.close();
      console.log(`Downloaded images for ${doctor.length} doctors.`);
    } catch (error) {
      console.log(error);
    }
  }

  generateUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
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

  checkDuplicate(doctors: IDoctor[]) {
    const linkMap = new Map();
    const duplicates:IDoctor[] = [];
    doctors.forEach((doc) => {
      if (linkMap.has(doc.link)) {
        duplicates.push(doc);
      } else {
        linkMap.set(doc, true);
      }
    });
    return {unique:linkMap, duplicates}
  }

 
} 