/* eslint-disable @typescript-eslint/ban-ts-comment */
import Bot from "./bot"
// import { district } from "./constance";
import departments  from "../departments.json";
// import { Doctor } from "../types";
import doctors from "../doctors.json";
import path from "path";
const bot = new Bot ()
import doc from "../doctors.json";

async function main () {
  try {
    // await bot.init({limitPage: 2, headless: false});
    // await bot.getDepartmentList(district);
    // const data = {
    //   "dhaka": [
    //     {
    //       "id": 1,
    //       "link": "https://www.doctorbangladesh.com/acupuncturist-dhaka/",
    //       "name": "Acupuncture Specialist in Dhaka"
    //     },
    //   ]
    // }
    //@ts-ignore
    // await bot.getDoctorList(departments.department, {checkUnique:true, doctors:doctors.doctor});
    // console.log(doctors.doctor.dhaka.length);
    // console.log(doctors.doctor.chittagong.length);
    // console.log(bot.getTotalDoctorsCount());
    //@ts-ignore
    // console.log(doctors.doctor.length);
    // await bot.handleLinkErrors()
    // await bot.handleImageError({errorFileNameFroRead:"imageError", errorFileNameFroWrite: "imageError2"})
    bot.makeSingleDocFile()
    // bot.combineAllDoc(["doctors.json","doctors1.json"])
    // const res = bot.checkDuplicate(doc.doctor)
    // console.log(res.duplicates.length);
    // console.log(res.unique.size);

    // download all images
    // await bot.downloadAllImagesFromDocList(doc.doctor)

    
    //@ts-ignore
    // bot.modifyAllDoc((doc:Doctor)=>({id: bot.generateUUIDv4() ,...doc,chamber:{...doc.chamber, appointmentNumber: doc.chamber.appointmentNumber.replace("Call Now","") } }))
  } catch (error) {
    console.log(error);
  }
}
main()


//  'kushtia',
//  'pabna',
//  'bogura',
//  'cumilla',
//  'narayanganj',
//  'mymensingh',
//  'rangpur',
//  'barisal',