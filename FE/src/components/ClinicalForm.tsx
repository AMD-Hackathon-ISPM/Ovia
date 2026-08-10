import { useState } from "react";
import { useFormContext, type ClinicalData } from "../context/FormContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";

const BRAND = "#D6697C";
const TEXT_COLOR = "#535861";

const OPTIONAL_NUMBERS: ReadonlyArray<{field:keyof ClinicalData;label:string;unit:string;placeholder:string}> = [
  {field:"cycleLengthDays",label:"Typical cycle length",unit:"days",placeholder:"e.g. 30"},
  {field:"systolicBp",label:"Systolic blood pressure",unit:"mmHg",placeholder:"e.g. 118"},
  {field:"diastolicBp",label:"Diastolic blood pressure",unit:"mmHg",placeholder:"e.g. 76"},
  {field:"fshMiuMl",label:"FSH",unit:"mIU/mL",placeholder:"optional"},
  {field:"lhMiuMl",label:"LH",unit:"mIU/mL",placeholder:"optional"},
  {field:"tshMiuL",label:"TSH",unit:"mIU/L",placeholder:"optional"},
  {field:"amhNgMl",label:"AMH",unit:"ng/mL",placeholder:"optional"},
];

const BINARY_FIELDS: ReadonlyArray<{field:keyof ClinicalData;label:string}> = [
  {field:"weightGain",label:"Recent or unexplained weight gain"},
  {field:"hairGrowth",label:"Increased facial or body hair growth"},
  {field:"skinDarkening",label:"New or increased skin darkening"},
  {field:"hairLoss",label:"Increased hair loss"},
  {field:"pimples",label:"Persistent pimples or acne"},
  {field:"fastFood",label:"Frequently eats fast food"},
  {field:"regularExercise",label:"Exercises regularly"},
];

export default function ClinicalForm() {
  const { state, dispatch, goToNextStep } = useFormContext();
  const { clinical } = state.data;
  const [error,setError]=useState("");
  const update=(field:keyof ClinicalData,value:string|boolean)=>dispatch({type:"SET_CLINICAL",value:{[field]:value}});

  const next=()=>{
    const height=Number(clinical.heightCm);const weight=Number(clinical.weightKg);
    if(!Number.isFinite(height)||height<80||height>230||!Number.isFinite(weight)||weight<20||weight>350){setError("Enter a plausible height and weight before continuing.");return}
    setError("");goToNextStep();
  };
  const bmi=Number(clinical.weightKg)/(Number(clinical.heightCm)/100)**2;

  return <div className="w-full space-y-6">
    <div><h2 className="text-2xl font-bold" style={{color:TEXT_COLOR}}>Clinical information</h2>
      <p className="mt-1 text-sm text-muted-foreground">Only inputs supported by the deployed clinical model are collected. Optional blanks remain explicitly missing.</p></div>

    <section className="space-y-4" aria-labelledby="measurements"><h3 id="measurements" className="font-bold" style={{color:BRAND}}>Measurements</h3>
      <div className="grid grid-cols-2 gap-4">
        <NumberField id="heightCm" label="Height" unit="cm" value={clinical.heightCm} onChange={v=>update("heightCm",v)} required />
        <NumberField id="weightKg" label="Weight" unit="kg" value={clinical.weightKg} onChange={v=>update("weightKg",v)} required />
      </div>
      {Number.isFinite(bmi)&&bmi>0&&<p className="text-sm text-muted-foreground">Derived BMI sent to the model: {bmi.toFixed(1)}</p>}
    </section>

    <section className="space-y-3" aria-labelledby="cycles"><h3 id="cycles" className="font-bold" style={{color:BRAND}}>Cycle information</h3>
      <Label>Cycle regularity <span className="font-normal text-muted-foreground">(optional)</span></Label>
      <div className="grid grid-cols-3 gap-2">
        {[{value:"",label:"Unknown"},{value:"regular",label:"Regular"},{value:"irregular",label:"Irregular"}].map(option=><button type="button" key={option.label} onClick={()=>update("cycleRegularity",option.value)} className="h-11 rounded-lg border text-sm font-semibold" style={clinical.cycleRegularity===option.value?{borderColor:BRAND,background:"#F9DCE2",color:BRAND}:{}}>{option.label}</button>)}
      </div>
    </section>

    <section className="space-y-4" aria-labelledby="optional"><h3 id="optional" className="font-bold" style={{color:BRAND}}>Optional measurements and laboratory values</h3>
      <p className="text-sm text-muted-foreground">Enter only values you know from a measurement or laboratory report.</p>
      <div className="grid grid-cols-2 gap-4">{OPTIONAL_NUMBERS.map(item=><NumberField key={item.field} id={item.field} label={item.label} unit={item.unit} placeholder={item.placeholder} value={clinical[item.field] as string} onChange={v=>update(item.field,v)} />)}</div>
    </section>

    <section className="space-y-2" aria-labelledby="reported"><h3 id="reported" className="font-bold" style={{color:BRAND}}>Reported factors</h3>
      {BINARY_FIELDS.map(item=><label key={item.field} className="flex items-center gap-3 rounded-xl border p-3 text-sm"><Checkbox checked={clinical[item.field] as boolean} onCheckedChange={v=>update(item.field,v===true)} /><span>{item.label}</span></label>)}
    </section>

    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end"><Button onClick={next} className="h-12 rounded-xl px-10 font-bold text-white" style={{backgroundColor:BRAND}}>Next</Button></div>
  </div>;
}

function NumberField({id,label,unit,value,onChange,placeholder,required}:{id:string;label:string;unit:string;value:string;onChange:(value:string)=>void;placeholder?:string;required?:boolean}){
  return <div className="space-y-2"><Label htmlFor={id} className="font-semibold">{label} ({unit}){required&&<span aria-hidden="true"> *</span>}</Label><Input id={id} type="number" min="0" step="any" required={required} value={value} placeholder={placeholder} onChange={event=>onChange(event.target.value)} className="h-12 rounded-lg" /></div>
}
