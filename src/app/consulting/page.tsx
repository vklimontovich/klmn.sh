import { TextPage } from "@/components/text-page";

export default function ConsultingPage() {
  return (
    <main className="w-full flex justify-center  mx-auto">
      <TextPage className="grow max-w-[1000px] mx-6 my-12">
        <h1>Consulting</h1>
        <p>
          Sometimes I help companies with their product development, infrastructure, and data engineering. I provide services
          as <b>CommonSense IT LLC</b>
        </p>
        <p>
          This page mainly created because Strip which is used for payments requires a public page with the description of our services.
        </p>
      </TextPage>
    </main>
  );
}
