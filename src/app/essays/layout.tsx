import Link from "next/link";
import { monoFont } from "@/app/fonts";
import Image from "next/image";
import headshot from "@/assets/headshot.jpg";

export default function EssaysLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-12 mx-auto px-4" style={{ maxWidth: "1000px", minHeight: "100vh" }}>
      <div className="flex justify-between items-center">
        <div className="text-2xl">
          <Link href={"/"} className={`font-extrabold text-blue-600 ${monoFont.className}`}>
            ❯./klmn.sh
          </Link>
        </div>
        <div className="flex gap-2 items-center">
          <i>
          by
          </i>
          <Link href={"/"}>
            <Image src={headshot} alt="photo" className="rounded-full h-8 w-8 md:h-8 md:w-8 hover:scale-110 transition-all duration-200" />
          </Link>
        </div>
      </div>
      <div className="py-12">{children}</div>
    </div>
  );
}
