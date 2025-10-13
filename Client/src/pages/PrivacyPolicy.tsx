import SimpleLayout from "@/components/SimpleLayout";

export default function PrivacyPolicy() {
  return (
    <SimpleLayout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
            <p className="text-gray-600 mb-8">Last updated: October 11, 2025</p>
            
            <div className="prose prose-lg max-w-none text-gray-700">
              <p className="mb-6">
                Welcome to Studese, a web app by Datadept that helps you manage your notes, calendar, tasks, and events — all in one organized place.
              </p>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">What We Collect</h2>
                <p className="mb-4">We collect:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Account info: name, email, password (encrypted)</li>
                  <li>Payment info: processed securely via Stripe</li>
                  <li>Usage data: analytics, cookies, and logs (to improve performance)</li>
                  <li>User content: notes, calendar items, and tasks you add to the app</li>
                </ul>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">How We Use Data</h2>
                <p className="mb-4">We use your data to:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Provide and improve our services</li>
                  <li>Personalize your experience</li>
                  <li>Handle billing and customer support</li>
                  <li>Communicate important updates or offers</li>
                </ul>
                <p>We never sell your personal data.</p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Cookies</h2>
                <p className="mb-4">
                  We use cookies to remember preferences and measure app performance. You can disable cookies in your browser, but some features may not work properly.
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Data Retention</h2>
                <p className="mb-4">
                  Your data is stored securely and retained only as long as necessary to provide our service or as required by law.
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
                <p className="mb-4">
                  We use encryption (HTTPS), secure databases, and trusted partners (like Stripe) to protect your information.
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Third Parties</h2>
                <p className="mb-4">
                  We may share limited data with trusted third-party tools (e.g., analytics or cloud storage) only to operate Studese effectively. All partners comply with privacy standards.
                </p>
              </div>

              <div className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
                <p className="mb-4">You can:</p>
                <ul className="list-disc pl-6 space-y-2 mb-4">
                  <li>Access or update your account info anytime</li>
                  <li>Request deletion of your data</li>
                  <li>Opt out of non-essential emails</li>
                </ul>
                <p>To exercise these rights, contact us at: Studese.com</p>
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
    </SimpleLayout>
  );
}
