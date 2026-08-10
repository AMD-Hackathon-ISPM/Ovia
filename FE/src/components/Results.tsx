import { useFormContext } from "../context/FormContext";
import { useSubmission } from "@/context/SubmissionContext";
import type { ImageModelEvidence, ModelStatus, PanelState, ConditionResult } from "@/lib/adapter";
import InspectionFigure from "./InspectionFigure";

const BRAND="#D6697C";const TEXT="#535861";
const pct=(value:number|null)=>value===null?"Not available":`${(value*100).toFixed(1)}%`;
const label=(value:string|null)=>value?value.toLowerCase().replaceAll("_"," "):"Not available";

export default function Results(){
  const {state:form}=useFormContext();const {state}=useSubmission();
  if(state.status!=="success")return <p role="alert">No completed analysis is available.</p>;
  const {outcome}=state;const evidence=outcome.evidence;const narrative=outcome.orchestration;
  return <div className="space-y-6" aria-live="polite">
    <header><p className="text-xs font-bold uppercase tracking-wider" style={{color:BRAND}}>Investigational screening support</p><h1 className="text-2xl font-bold" style={{color:TEXT}}>Analysis results</h1><p className="mt-1 text-sm text-muted-foreground">Analysis ID: {outcome.requestId}</p></header>

    {evidence?<>
      <section aria-labelledby="model-output" className="space-y-3"><div><h2 id="model-output" className="text-lg font-bold" style={{color:TEXT}}>Model output</h2><p className="text-sm text-muted-foreground">These values come directly from deterministic backend inference. Different models answer different questions and their probabilities are not combined.</p></div>
        <div className="grid gap-3 md:grid-cols-2">
          <ModelCard title="BiomedCLIP morphology" model={evidence.imageModels.biomedclip}><Metric name="Output" value={label(evidence.imageModels.biomedclip.predictedLabel)}/><Metric name="Probability" value={pct(evidence.imageModels.biomedclip.probability)}/></ModelCard>
          <ModelCard title="ConvNeXt ultrasound appearance" model={evidence.imageModels.convnextTiny}><Metric name="Highest-probability class" value={label(evidence.imageModels.convnextTiny.predictedLabel)}/><Metric name="Class probability" value={pct(evidence.imageModels.convnextTiny.probability)}/></ModelCard>
          <EvidenceCard title="XGBoost clinical screening" status={evidence.clinicalModel.status} version={evidence.clinicalModel.modelVersion} warnings={evidence.clinicalModel.warnings}><Metric name="Calibrated screening probability" value={pct(evidence.clinicalModel.calibratedProbability)}/><Metric name="Screening threshold met" value={yesNo(evidence.clinicalModel.screeningThresholdMet)}/><Metric name="Fields supplied" value={String(evidence.clinicalModel.suppliedFeatureCount)}/></EvidenceCard>
          <EvidenceCard title="U-Net++ lesion segmentation" status={evidence.segmentation.status} version={evidence.segmentation.modelVersion} warnings={evidence.segmentation.warnings}><Metric name="Segmentation available" value={evidence.segmentation.segmentationAvailable?"Yes":"No"}/><Metric name="Foreground area" value={pct(evidence.segmentation.foregroundFraction)}/><Metric name="Separated regions" value={evidence.segmentation.connectedComponentCount?.toString()??"Not available"}/></EvidenceCard>
        </div>
        <div className="rounded-xl border bg-muted/40 p-4 text-sm" style={{color:TEXT}}><strong>Ovarian tumor classification is not reported.</strong> The deployed U-Net++ identifies a candidate lesion region; it does not establish tumor type, pathology, malignancy, or cancer.</div>
      </section>

      <section aria-labelledby="interpretation" className="rounded-2xl border p-5" style={{borderColor:BRAND}}><p className="text-xs font-bold uppercase tracking-wider" style={{color:BRAND}}>LLM interpretation</p><h2 id="interpretation" className="mt-1 text-lg font-bold" style={{color:TEXT}}>{narrative?.status==="success"?"Synthesized evidence context":"Interpretation unavailable"}</h2>
        {narrative?.summary&&<p className="mt-2 text-sm leading-relaxed">{narrative.summary}</p>}
        <p className="mt-2 text-sm">{narrative?.agreement.explanation??"Deterministic evidence is shown without an LLM narrative."}</p>
        {(narrative?.evidence.length??0)>0&&<ul className="mt-3 space-y-2">{narrative!.evidence.map((item,index)=><li key={`${item.source}-${index}`} className="rounded-xl bg-muted p-3 text-sm"><strong>{item.finding}</strong><span className="block text-muted-foreground">{item.importance}</span></li>)}</ul>}
        {(narrative?.limitations.length??0)>0&&<div className="mt-4"><h3 className="font-bold">Limitations</h3><ul className="list-disc pl-5 text-sm">{narrative!.limitations.map(item=><li key={item}>{item}</li>)}</ul></div>}
        <div className="mt-4 rounded-xl bg-[#F9DCE2] p-4 text-sm"><strong>Recommended next step:</strong> {narrative?.recommendedNextStep??"Review these screening-support outputs with a qualified clinician."}</div>
      </section>

      {evidence.warnings.length>0&&<section><h2 className="font-bold">Evidence notes</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{evidence.warnings.map(item=><li key={item}>{item}</li>)}</ul></section>}
    </>:<FixtureResults panels={outcome.panels}/>}

    {form.data.ultrasoundImage&&<InspectionFigure src={form.data.ultrasoundImage} regions={outcome.inspection??[]} maskDataUrl={evidence?.segmentation.maskPngDataUrl??null}/>}
    <p className="rounded-xl bg-muted p-4 text-sm font-medium">{narrative?.disclaimer??"Investigational screening support only; not a diagnosis. Review all outputs with a qualified clinician."}</p>
  </div>;
}

function EvidenceCard({title,status,version,warnings,children}:{title:string;status:ModelStatus;version:string;warnings:string[];children:React.ReactNode}){return <article className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold" style={{color:TEXT}}>{title}</h3><Status value={status}/></div><p className="mt-1 break-all text-[11px] text-muted-foreground">{version}</p>{status==="success"?<dl className="mt-4 space-y-2">{children}</dl>:<p className="mt-4 text-sm">No output was substituted for unavailable evidence.</p>}{warnings.map(item=><p key={item} className="mt-3 text-xs text-muted-foreground">{item}</p>)}</article>}
function ModelCard({title,model,children}:{title:string;model:ImageModelEvidence;children:React.ReactNode}){return <EvidenceCard title={title} status={model.status} version={model.modelVersion} warnings={model.warnings}>{children}</EvidenceCard>}
function Metric({name,value}:{name:string;value:string}){return <div className="flex items-start justify-between gap-3"><dt className="text-sm text-muted-foreground">{name}</dt><dd className="text-right text-sm font-semibold capitalize">{value}</dd></div>}
function Status({value}:{value:ModelStatus}){return <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold uppercase tracking-wide">{value.replaceAll("_"," ")}</span>}
function yesNo(value:boolean|null){return value===null?"Not available":value?"Yes":"No"}
function FixtureResults({panels}:{panels:{pcos:PanelState<ConditionResult>;ovarianCyst:PanelState<ConditionResult>;ovarianTumor:PanelState<ConditionResult>}}){return <section className="rounded-2xl border p-5"><h2 className="font-bold">Demo fixture output</h2><p className="mt-2 text-sm text-muted-foreground">This offline fixture has no production evidence envelope. Switch VITE_OVIA_ADAPTER to live to use the Rust ONNX backend.</p><pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(panels,null,2)}</pre></section>}
