"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { createProjectProjectsPost, ProjectCreate } from "@/client";
import { apiClient } from "@/lib/api-client";

type FormStep = 1 | 2 | 3 | 4;

interface FormData {
  description: string;
  deadline: string;
  priority: "high" | "medium" | "low" | null;
  knowsSteps: boolean | null;
}

export default function NewProjectPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [formData, setFormData] = useState<FormData>({
    description: "",
    deadline: "",
    priority: null,
    knowsSteps: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 4;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => (prev + 1) as FormStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as FormStep);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("No authentication token available");
      }

      const projectName = formData.description.split("\n")[0].slice(0, 100) || "Untitled Project";

      const projectData: ProjectCreate = {
        name: projectName,
        description: formData.description,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : null,
        priority: formData.priority || "medium",
        knows_steps: formData.knowsSteps ?? false,
        status: "active",
        is_active: true,
      };

      console.log("Creating project with data:", projectData);

      const response = await createProjectProjectsPost({
        client: apiClient,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: projectData,
      });

      console.log("Project creation response:", response);

      if (response.data) {
        router.push("/home");
      } else {
        console.error("No data in response:", response);
        throw new Error("Failed to create project: No data returned");
      }
    } catch (err) {
      console.error("Error creating project:", err);
      
      // Try to extract validation error details
      let errorMessage = "Failed to create project";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null) {
        // Check if it's a 422 validation error
        if ('response' in err && err.response) {
          const response = err.response as any;
          if (response.status === 422 && response.data) {
            console.error("Validation error details:", response.data);
            errorMessage = `Validation error: ${JSON.stringify(response.data)}`;
          }
        } else {
          errorMessage = JSON.stringify(err);
        }
      }
      
      setError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.description.trim().length > 0;
      case 2:
        return formData.deadline.length > 0;
      case 3:
        return formData.priority !== null;
      case 4:
        return formData.knowsSteps !== null;
      default:
        return false;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (canProceed() && !isSubmitting) {
          if (currentStep < totalSteps) {
            handleNext();
          } else {
            handleSubmit();
          }
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Backspace") {
        e.preventDefault();
        if (currentStep > 1 && !isSubmitting) {
          handleBack();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, formData, isSubmitting]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="flex justify-center gap-2 mb-12">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={`w-3 h-3 rounded-full transition-colors ${
                index + 1 === currentStep
                  ? "bg-blue-600"
                  : index + 1 < currentStep
                  ? "bg-blue-400"
                  : "bg-gray-300"
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 min-h-[400px] flex flex-col">
          {currentStep === 1 && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                What are you working on?
              </h2>
              <p className="text-gray-600 mb-8">
                Describe your project in your own words. Don&apos;t worry about being perfect.
              </p>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="e.g., Build a mobile app for my class project, Write a research paper on climate change, Create a website for my portfolio..."
                className="flex-1 min-h-[200px] p-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none text-lg"
                autoFocus
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                When is this due?
              </h2>
              <p className="text-gray-600 mb-8">
                Set a deadline to help TimeBud prioritize your work.
              </p>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) =>
                  setFormData({ ...formData, deadline: e.target.value })
                }
                className="min-h-[66px] px-6 py-4 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 text-lg"
                autoFocus
              />
            </div>
          )}

          {currentStep === 3 && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                How important is this?
              </h2>
              <p className="text-gray-600 mb-8">
                This helps TimeBud balance your workload across projects.
              </p>
              <div className="flex-1 flex flex-col gap-4">
                <button
                  onClick={() => setFormData({ ...formData, priority: "high" })}
                  className={`min-h-[88px] px-8 py-6 rounded-lg border-2 font-semibold text-xl transition-all ${
                    formData.priority === "high"
                      ? "bg-red-50 border-red-500 text-red-900"
                      : "bg-white border-gray-300 text-gray-900 hover:border-red-300"
                  }`}
                >
                  High Priority
                </button>
                <button
                  onClick={() => setFormData({ ...formData, priority: "medium" })}
                  className={`min-h-[88px] px-8 py-6 rounded-lg border-2 font-semibold text-xl transition-all ${
                    formData.priority === "medium"
                      ? "bg-yellow-50 border-yellow-500 text-yellow-900"
                      : "bg-white border-gray-300 text-gray-900 hover:border-yellow-300"
                  }`}
                >
                  Medium Priority
                </button>
                <button
                  onClick={() => setFormData({ ...formData, priority: "low" })}
                  className={`min-h-[88px] px-8 py-6 rounded-lg border-2 font-semibold text-xl transition-all ${
                    formData.priority === "low"
                      ? "bg-green-50 border-green-500 text-green-900"
                      : "bg-white border-gray-300 text-gray-900 hover:border-green-300"
                  }`}
                >
                  Low Priority
                </button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Do you know the steps?
              </h2>
              <p className="text-gray-600 mb-8">
                If not, TimeBud can research and suggest a plan for you.
              </p>
              <div className="flex-1 flex flex-col gap-4">
                <button
                  onClick={() => setFormData({ ...formData, knowsSteps: true })}
                  className={`min-h-[88px] px-8 py-6 rounded-lg border-2 font-semibold text-xl transition-all ${
                    formData.knowsSteps === true
                      ? "bg-blue-50 border-blue-500 text-blue-900"
                      : "bg-white border-gray-300 text-gray-900 hover:border-blue-300"
                  }`}
                >
                  Yes, I know what to do
                </button>
                <button
                  onClick={() => setFormData({ ...formData, knowsSteps: false })}
                  className={`min-h-[88px] px-8 py-6 rounded-lg border-2 font-semibold text-xl transition-all ${
                    formData.knowsSteps === false
                      ? "bg-purple-50 border-purple-500 text-purple-900"
                      : "bg-white border-gray-300 text-gray-900 hover:border-purple-300"
                  }`}
                >
                  No, help me plan it
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="min-h-[56px] px-8 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <span>Back</span>
                <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 rounded">
                  ⌘⌫
                </kbd>
              </button>
            )}
            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                disabled={!canProceed() || isSubmitting}
                className="flex-1 min-h-[56px] px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>Next</span>
                <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono bg-blue-700 border border-blue-800 rounded">
                  ⌘↵
                </kbd>
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canProceed() || isSubmitting}
                className="flex-1 min-h-[56px] px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>{isSubmitting ? "Creating..." : "Create Project"}</span>
                {!isSubmitting && (
                  <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono bg-blue-700 border border-blue-800 rounded">
                    ⌘↵
                  </kbd>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
