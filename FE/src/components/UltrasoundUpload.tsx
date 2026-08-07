import { useRef, useState } from "react";
import { Upload, AlertCircle } from "../lib/icons";
import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";

const BRAND = "#D6697C";
const TEXT_COLOR = "#535861";

export default function UltrasoundUpload() {
  const { state, dispatch, goToNextStep, goToStep } = useFormContext();
  const [preview, setPreview] = useState<string | null>(
    state.data.ultrasoundImage
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      dispatch({ type: "SET_ULTRASOUND_IMAGE", value: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(null);
    dispatch({ type: "SET_ULTRASOUND_IMAGE", value: null });
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSkip = () => {
    goToNextStep();
  };

  return (
    <div className="w-full space-y-5">
      {/* Header — ditambahkan sesuai gambar */}
      <div>
        <h2 className="text-2xl font-bold" style={{ color: TEXT_COLOR }}>
          Ultrasound
        </h2>
        <p
          className="text-sm mt-1"
          style={{ color: TEXT_COLOR, opacity: 0.58 }}
        >
          Recommended for the most accurate result. You can skip if
          unavailable.
        </p>
      </div>

      {preview ? (
        <div className="rounded-2xl overflow-hidden border border-border">
          <img
            src={preview}
            alt="Ultrasound preview"
            className="w-full h-52 object-contain bg-muted"
          />
          <div className="flex gap-2 p-3 bg-muted">
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="flex-1 rounded-full text-xs"
            >
              Change
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              className="flex-1 rounded-full text-xs text-destructive"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full cursor-pointer"
        >
          <div className="w-full border-2 border-dashed border-primary/40 rounded-2xl bg-primary-soft/40 flex flex-col items-center justify-center py-12 px-6 transition-colors hover:bg-primary-soft/60">
            <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground">
              Upload Ultrasound
            </p>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Recommended for the most accurate result. You can skip if
              unavailable.
            </p>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />

      {!preview && (
        <div className="flex items-start gap-3 bg-[#F5EEDA] rounded-xl p-4">
          <div className="w-6 h-6 rounded-full border-2 border-[#8A7B4F] flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-[#8A7B4F]" strokeWidth={0} fill="currentColor" />
          </div>
          <p className="text-sm text-[#6B5F3E] leading-relaxed">
            Skipping this step prevents ovarian cyst and tumor screening and
            lowers your result's confidence, making it more likely to over- or
            under-estimate your risk.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => goToStep("clinical")}
          className="flex-1 h-12 text-base rounded-xl font-bold text-white border-none"
          style={{ backgroundColor: BRAND }}
        >
          Back
        </Button>
        {preview ? (
          <Button
            onClick={goToNextStep}
            className="flex-1 h-12 text-base rounded-xl font-bold text-white border-none"
            style={{ backgroundColor: BRAND }}
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSkip}
            className="flex-1 h-12 text-base rounded-xl font-bold text-white border-none"
            style={{ backgroundColor: BRAND }}
          >
            Next
          </Button>
        )}
      </div>
    </div>
  );
}