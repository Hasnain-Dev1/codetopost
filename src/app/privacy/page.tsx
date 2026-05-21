export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-black text-white py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-sm text-zinc-400 leading-relaxed">
          <p><strong className="text-white">Last updated:</strong> May 21, 2024</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">1. Information We Collect</h2>
          <p>We collect your email address to authenticate your account via Supabase. If you connect Twitter or LinkedIn, we store your OAuth access tokens to enable AutoPost features.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">2. How We Use Your Information</h2>
          <p>Your email is used solely for authentication. OAuth tokens are used only to post content on your behalf when you explicitly click "Post Now". We never post without your direct action.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">3. Data Storage</h2>
          <p>All data is securely stored on Supabase (AWS infrastructure). OAuth tokens are encrypted at rest.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">4. Third-Party Services</h2>
          <p>We use the following services:</p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li><strong>Supabase:</strong> Authentication & database</li>
            <li><strong>Twitter API:</strong> Posting tweets (only if connected)</li>
            <li><strong>LinkedIn API:</strong> Posting updates (only if connected)</li>
            <li><strong>Groq:</strong> AI caption generation</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-white mt-8">5. Data Deletion</h2>
          <p>You can delete your account at any time by contacting us. This permanently deletes all your data, including OAuth connections and generated content.</p>
          
          <h2 className="text-xl font-semibold text-white mt-8">6. Contact</h2>
          <p>If you have questions, email us at: <strong className="text-white">support@codetopost.vercel.app</strong></p>
        </div>
      </div>
    </main>
  );
}