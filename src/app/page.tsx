import { SignIn } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-4">
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-gray-900 mb-6">
          TimeBud
        </h1>
        <p className="text-xl text-gray-600 max-w-md">
          You tell us how long you have. We tell you exactly what to do.
        </p>
      </div>
      
      <SignIn 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg"
          }
        }}
        routing="hash"
        afterSignInUrl="/home"
      />
    </div>
  );
}
