/* eslint-disable @typescript-eslint/ban-ts-comment */
import Bot from "./bot"
// import { district } from "./constance";
// import departments  from "../departments.json";
// import { Doctor } from "../types";
import doctors from "../doctors.json";
const bot = new Bot ()

async function main () {
  try {
    // await bot.init();
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
    // await bot.getDoctorList(departments.department);
    // console.log(doctors.doctor.dhaka.length);
    // console.log(doctors.doctor.chittagong.length);
    // console.log(bot.getTotalDoctorsCount());
    //@ts-ignore
    // console.log(doctors.doctor.length);
    // await bot.handleLinkErrors()
    // await bot.handleImageError()
    // bot.makeSingleDocFile()
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