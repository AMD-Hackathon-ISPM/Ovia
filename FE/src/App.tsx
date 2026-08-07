import { FormProvider, useFormContext } from "./context/FormContext";
import ProgressIndicator from "./components/ProgressIndicator";
import SplashScreen from "./components/SplashScreen";
import EligibilityOvary from "./components/EligibilityOvary";
import EligibilityPregnancy from "./components/EligibilityPregnancy";
import EligibilityAge from "./components/EligibilityAge";
import NotEligible from "./components/NotEligible";
import ClinicalForm from "./components/ClinicalForm";
import UltrasoundUpload from "./components/UltrasoundUpload";
import ReviewConsent from "./components/ReviewConsent";
import Results from "./components/Results";
import DisclaimerFooter from "./components/DisclaimerFooter";

function StepRouter() {
  const { state } = useFormContext();

  switch (state.step) {
    case "splash":
      return <SplashScreen />;
    case "eligibility-ovary":
      return (
        <>
          <EligibilityOvary />
        </>
      );
    case "eligibility-pregnancy":
      return (
        <>
          <EligibilityPregnancy />
        </>
      );
    case "eligibility-age":
      return (
        <>
          <EligibilityAge />
        </>
      );
    case "not-eligible":
      return <NotEligible />;
    case "clinical":
      return (
        <>
          <ProgressIndicator />
          <ClinicalForm />
        </>
      );
    case "ultrasound":
      return (
        <>
          <ProgressIndicator />
          <UltrasoundUpload />
        </>
      );
    case "review":
      return (
        <>
          <ProgressIndicator />
          <ReviewConsent />
        </>
      );
    case "results":
      return <Results />;
    default:
      return null;
  }
}

export default function App() {
  return (
    <FormProvider>
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 max-w-lg mx-auto w-full px-4 pt-6 pb-4">
          <StepRouter />
        </div>
        <DisclaimerFooter />
      </div>
    </FormProvider>
  );
}