import { Pencil, Upload } from "../lib/icons";
import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { useSubmission } from "@/context/SubmissionContext";
import SubmissionErrorNotice from "./SubmissionErrorNotice";

const BRAND="#D6697C";const TEXT="#535861";

export default function ReviewConsent(){
  const {state,dispatch,goToStep}=useFormContext();const {state:submission,submit}=useSubmission();const {data}=state;const c=data.clinical;
  const height=Number(c.heightCm)/100;const bmi=Number(c.weightKg)/(height*height);
  const factors=[
    [c.weightGain,"Weight gain"],[c.hairGrowth,"Increased hair growth"],[c.skinDarkening,"Skin darkening"],[c.hairLoss,"Hair loss"],[c.pimples,"Persistent acne"],[c.fastFood,"Frequent fast food"],[c.regularExercise,"Regular exercise"],
  ].filter(([selected])=>selected).map(([,label])=>label as string);
  const optional=[
    ["Cycle length",c.cycleLengthDays,"days"],["Blood pressure",c.systolicBp&&c.diastolicBp?`${c.systolicBp}/${c.diastolicBp}`:"","mmHg"],["FSH",c.fshMiuMl,"mIU/mL"],["LH",c.lhMiuMl,"mIU/mL"],["TSH",c.tshMiuL,"mIU/L"],["AMH",c.amhNgMl,"ng/mL"],
  ].filter(([,value])=>value);
  return <div className="w-full space-y-5">
    <SubmissionErrorNotice forClass="retryable_error" />
    <div><h2 className="text-2xl font-bold" style={{color:TEXT}}>Review</h2><p className="mt-1 text-sm text-muted-foreground">Confirm the transient data that will be sent for this analysis.</p></div>
    <section className="overflow-hidden rounded-2xl border" style={{borderColor:BRAND}}>
      <header className="flex items-center justify-between px-5 py-3 text-white" style={{backgroundColor:BRAND}}><h3 className="font-bold">Clinical model inputs</h3><button type="button" onClick={()=>goToStep("clinical")} aria-label="Edit clinical information"><Pencil className="h-4 w-4" /></button></header>
      <div className="space-y-4 p-5 text-sm" style={{color:TEXT}}>
        <div className="grid grid-cols-3 gap-3"><Fact value={data.age} label="years"/><Fact value={Number.isFinite(bmi)?bmi.toFixed(1):"—"} label="BMI"/><Fact value={c.cycleRegularity||"Unknown"} label="cycle"/></div>
        {optional.length>0&&<ul className="space-y-1">{optional.map(([label,value,unit])=><li key={label}>• {label}: {value} {unit}</li>)}</ul>}
        <p><strong>Reported factors:</strong> {factors.length?factors.join(", "):"none selected"}</p>
        <p className="text-xs text-muted-foreground">Unentered optional model features remain missing and are handled by the deployed preprocessing contract.</p>
      </div>
    </section>
    <section className="flex items-center justify-between gap-3 rounded-2xl border p-4" style={{borderColor:BRAND}}><div className="flex items-center gap-3">{data.ultrasoundImage?<img src={data.ultrasoundImage} alt="Attached ultrasound preview" className="h-16 w-16 rounded-lg object-cover"/>:<div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted"><Upload className="h-5 w-5"/></div>}<div><p className="font-bold">Ultrasound</p><p className="text-xs text-muted-foreground">{data.ultrasoundImage?"Attached for three image models":"Not attached; image models will be unavailable"}</p></div></div><Button onClick={()=>goToStep("ultrasound")} className="rounded-full text-white" style={{backgroundColor:BRAND}}>Change</Button></section>
    <div className="flex items-start gap-3 rounded-xl bg-muted p-4"><Checkbox id="consent" checked={data.consentGiven} onCheckedChange={v=>dispatch({type:"SET_CONSENT",value:v===true})}/><Label htmlFor="consent" className="text-sm leading-relaxed">I confirm these inputs are accurate and consent to this one-time screening-support analysis. Ovia does not retain the image in browser storage.</Label></div>
    <div className="flex gap-3"><Button onClick={()=>goToStep("ultrasound")} className="h-12 flex-1 text-white" style={{backgroundColor:BRAND}}>Back</Button><Button onClick={submit} disabled={!data.consentGiven||submission.status==="submitting"} className="h-12 flex-1 text-white" style={{backgroundColor:BRAND}}>Submit</Button></div>
  </div>;
}

function Fact({value,label}:{value:string;label:string}){return <div className="rounded-xl bg-[#FADADD] p-3 text-center"><p className="font-bold" style={{color:BRAND}}>{value||"—"}</p><p className="text-xs" style={{color:BRAND}}>{label}</p></div>}
