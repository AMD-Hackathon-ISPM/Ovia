import { useFormContext } from "../context/FormContext";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export default function NotEligible() {
  const { dispatch } = useFormContext();

  const handleRestart = () => {
    dispatch({ type: "RESET" });
  };

  return (
    <Card className="w-full text-center">
      <CardHeader>
        <CardTitle className="text-xl">Thank you for your honesty</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground leading-relaxed">
          This screening tool is designed for people who meet certain criteria.
          Based on your answers, it may not be relevant for you right now.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Please consult a healthcare professional for any concerns about your
          health.
        </p>
        <Button onClick={handleRestart} variant="outline" className="mt-4">
          Start Over
        </Button>
      </CardContent>
    </Card>
  );
}