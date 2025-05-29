async function main () {
    try {
      const res =  await fetch("https://raw.githubusercontent.com/DeveloperRejaul/doc-rated/refs/heads/main/doc-list/barisal/0-Anesthesiology-(Pain)-Specialist-in-Barisal-doctors.json");
      console.log(await res.json());
      
    } catch (error) {
        console.log(error);
        
    }
}
main()