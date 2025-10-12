import Layout from "@/components/Layout";

export default function TermsOfService() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Studese – Terms of Service</h1>
            <p className="text-gray-600 mb-8">Last updated: October 11, 2025</p>
            
            <div className="prose prose-lg max-w-none text-gray-700">
              <p className="mb-6">
                Welcome to Studese, a web app by Datadept that helps you manage your notes, calendar, tasks, and events — all in one organized place.
              </p>
              <p className="mb-8">
                By creating an account or using Studese, you agree to these Terms and our Privacy Policy. Please read them carefully.
              </p>

              <div className="border-t pt-6 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Overview</h2>
                <p className="mb-6">
                  Studese provides tools to help users stay productive, plan their schedules, and store notes securely. By accessing our web app, you agree to follow our Terms and use Studese responsibly.
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Accounts</h2>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>You must be at least 13 years old to use Studese.</li>
                  <li>You're responsible for keeping your account secure — don't share your login info.</li>
                  <li>You must provide accurate information when creating your account.</li>
                  <li>You can delete your account at any time through your settings or by contacting us.</li>
                </ul>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Payments & Subscriptions</h2>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Studese uses Stripe to process payments securely.</li>
                  <li>All paid plans renew automatically unless you cancel before the next billing cycle.</li>
                  <li>Prices may change with notice.</li>
                  <li>Refunds are handled according to our refund policy (if applicable) — contact support for assistance.</li>
                  <li>We don't store your full credit card details; Stripe handles that securely.</li>
                </ul>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Acceptable Use</h2>
                <p className="mb-4">You agree not to:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Upload harmful, illegal, or offensive content.</li>
                  <li>Attempt to hack, copy, or resell our app.</li>
                  <li>Use Studese in any way that violates laws or harms others.</li>
                </ul>
                <p>We may suspend or terminate accounts that break these rules.</p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
                <p className="mb-4">
                  Studese is provided "as is." Datadept isn't responsible for lost data, downtime, or indirect damages. We'll always do our best to provide reliable, secure service.
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Updates to These Terms</h2>
                <p className="mb-4">
                  We may update these Terms occasionally. When we do, we'll post the new version and notify you by email or in-app.
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Contact</h2>
                <p className="mb-4">
                  For questions or support, reach out to: studese.com
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
