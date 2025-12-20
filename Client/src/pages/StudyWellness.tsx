import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StudyWellness = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Study & Wellness</h1>
        <p className="text-muted-foreground mt-2">
          Tips for effective studying and maintaining mental health.
        </p>
      </div>

      {/* Mental Health Tips Card */}
      <Card>
        <CardHeader>
          <CardTitle>Mental Health Tips</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-medium">• Take regular breaks during study sessions (try the Pomodoro technique: 25min study, 5min break).</p>
          <p className="font-medium">• Get enough sleep - it's crucial for memory consolidation and focus.</p>
          <p className="font-medium">• Practice mindfulness or meditation to reduce study-related anxiety.</p>
          <p className="font-medium">• Stay connected with friends and family for emotional support.</p>
        </CardContent>
      </Card>

      {/* Study Techniques Card */}
      <Card>
        <CardHeader>
          <CardTitle>Study Techniques</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-medium">• <span className="text-primary">Spaced Repetition:</span> Review material over increasing intervals of time.</p>
          <p className="font-medium">• <span className="text-primary">Active Recall:</span> Test yourself instead of just re-reading notes.</p>
          <p className="font-medium">• <span className="text-primary">Feynman Technique:</span> Explain concepts in simple terms as if teaching someone else.</p>
          <p className="font-medium">• <span className="text-primary">Interleaving:</span> Mix different topics or subjects in a single study session.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudyWellness;
