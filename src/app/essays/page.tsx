import { EssaysList } from "@/components/essays-list";
import { essays } from "@/content";

export default function EssaysListPage() {
  return (
    <div>
      <p>Sometimes I write about startups, and other things:</p>
      <EssaysList className="mt-2" essays={essays} />
    </div>
  );
}