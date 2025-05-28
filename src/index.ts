import Bot from "./bot"
import { district } from "./constance";
import departments  from "../departments.json";
// import doctors from "../doctors.json";
const bot = new Bot ()

async function main () {
  try {
    await bot.init();
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
    await bot.getDoctorList(departments.department);
    // console.log(doctors.doctor.dhaka.length);
    // console.log(doctors.doctor.chittagong.length);
    
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