import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const StudyWellness = () => {
  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Study & Wellness</h1>
          <p className="text-muted-foreground mt-2">
            Tips for effective studying and maintaining mental health.
          </p>
        </div>

        {/* Content will go here */}
        <Card>
          <CardHeader>
            <CardTitle>Mental Health Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Content about mental wellness will go here...</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Study Techniques</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Content about study methods will go here...</p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default StudyWellness;
