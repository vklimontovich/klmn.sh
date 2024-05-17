import { Loader } from "lucide-react";

export default function Loading() {
  return <div className="w-full h-screen flex justify-center items-center backdrop-blur bg-white">
    <Loader className="w-12 h-12 text-blue-600 animate-spin" />
  </div>

}