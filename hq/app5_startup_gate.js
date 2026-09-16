// Chip In HQ startup gate
// Business setup must never appear until private storage has been resolved.
const chipInOriginalShowSetup=showSetup;
let chipInBusinessSetupAllowed=false;
showSetup=function(){
  if(!chipInBusinessSetupAllowed)return;
  return chipInOriginalShowSetup();
};
function chipInAllowBusinessSetup(){
  chipInBusinessSetupAllowed=true;
  return showSetup();
}
