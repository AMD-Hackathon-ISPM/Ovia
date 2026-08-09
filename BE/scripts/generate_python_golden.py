"""Generate cross-runtime references from the original pipeline preprocessing modules."""
from __future__ import annotations
import json, math, sys
from pathlib import Path
import cv2, numpy as np, onnxruntime as ort
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]; OVIA=ROOT.parent
sys.path.insert(0,str(OVIA/"Models/BiomedCLIPPipeline/src"));from ovia_biomedclip.data import build_eval_transform
sys.path.insert(0,str(OVIA/"Models/ConvNeXt-TinyPipeline/src"));from ovia_convnext.preprocessing import preprocess_numpy
sys.path.insert(0,str(OVIA/"Models/U-NetPipeline/src"));from ovia_unet.geometry import letterbox,inverse_letterbox

image_path=ROOT/"tests/fixtures/synthetic_ultrasound.png"; pil=Image.open(image_path).convert("RGB"); rgb=np.asarray(pil)
def session(name):return ort.InferenceSession(str(ROOT/"models"/name),providers=["CPUExecutionProvider"])
biomed_tensor=build_eval_transform()(pil).numpy()[None].astype(np.float32);biomed_logit=float(session("biomedclip.onnx").run(["logit"],{"image":biomed_tensor})[0].reshape(-1)[0])
conv_logits=session("convnext_tiny.onnx").run(["logits"],{"image":preprocess_numpy(pil)[None]})[0][0];temp=.8087205716282806;conv_probs=np.exp((conv_logits-conv_logits.max())/temp);conv_probs/=conv_probs.sum()
boxed,meta=letterbox(rgb,None,512);unet_tensor=((boxed.astype(np.float32)/255-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)).transpose(2,0,1)[None];logits=session("unetpp_otu2d.onnx").run(["logits"],{"image":unet_tensor})[0][0,0];mask=inverse_letterbox((1/(1+np.exp(-logits))>=.30).astype(np.uint8),meta,True);ys,xs=np.where(mask>0)
metadata=json.loads((ROOT/"models/metadata/xgboost.json").read_text());base=metadata["ordered_feature_list"][:34];med=metadata["missing_value_behavior"]["medians"];values={"age_years":29.,"weight_kg":68.,"height_cm":163.,"bmi":68/(1.63**2),"cycle_is_regular_2":0.,"cycle_is_irregular_4":1.,"cycle_is_unknown":0.,"hair_growth":1.};features=np.array([[values.get(k,med[k]) for k in base]+[0. if k in values else 1. for k in base]],np.float32);raw=float(session("xgboost.onnx").run(None,{"features":features})[1][0,1]);cal=1/(1+math.exp(-(1.287716202909563*math.log(raw/(1-raw))-0.4671930270008069)))
out={"fixture":"synthetic_ultrasound.png","python_runtime":{"onnxruntime":ort.__version__,"opencv":cv2.__version__},"biomedclip":{"logit":biomed_logit,"probability":1/(1+math.exp(-biomed_logit))},"convnext":{"logits":conv_logits.tolist(),"probabilities":conv_probs.tolist()},"xgboost":{"raw_probability":raw,"calibrated_probability":cal},"unetpp":{"mask_width":int(mask.shape[1]),"mask_height":int(mask.shape[0]),"foreground_pixels":int(mask.sum()),"foreground_fraction":float(mask.mean()),"bounding_box":None if not len(xs) else {"x_min":int(xs.min()),"y_min":int(ys.min()),"x_max":int(xs.max()),"y_max":int(ys.max())}}}
(ROOT/"tests/fixtures/python_golden.json").write_text(json.dumps(out,indent=2)+"\n");print(json.dumps(out,indent=2))
