const fs=require('fs');
module.exports=({config})=>{
 const googleFile=process.env.GOOGLE_SERVICES_FILE || './google-services.json';
 return {...config,
  android:{...config.android,...(fs.existsSync(googleFile)?{googleServicesFile:googleFile}:{})},
  extra:{...config.extra,eas:{...config.extra?.eas,...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID?{projectId:process.env.EXPO_PUBLIC_EAS_PROJECT_ID}:{})}},
 };
};
