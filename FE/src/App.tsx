import { FormProvider, useFormContext } from "./context/FormContext";
import { SubmissionProvider } from "./context/SubmissionContext";
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
import TerminalError from "./components/TerminalError";
import ProcessingOverlay from "./components/ProcessingOverlay";
import SubmissionErrorNotice from "./components/SubmissionErrorNotice";
import DisclaimerFooter from "./components/DisclaimerFooter";
import DemoDrawer from "./components/DemoDrawer";

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
          {/* A server quality rejection returns here with mapped guidance;
              the questionnaire is left untouched. */}
          <SubmissionErrorNotice forClass="image_rejected_server" />
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
    case "error":
      return <TerminalError />;
    default:
      return null;
  }
}

export default function App() {
  return (
    <FormProvider>
      <SubmissionProvider>
        <div className="min-h-screen bg-background flex flex-col">
          <div className="flex-1 max-w-lg mx-auto w-full px-4 pt-6 pb-4">
            <StepRouter />
          </div>
          <DisclaimerFooter />
          <ProcessingOverlay />
          {import.meta.env.DEV && <DemoDrawer />}
        </div>
      </SubmissionProvider>
    </FormProvider>
  );
}
