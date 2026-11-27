import { PoolRequestDetail } from "@/modules/umrah/components/pool-request-detail";
export default async function Page({params}:{params:Promise<{id:string}>}) { return <PoolRequestDetail id={(await params).id} agent/>; }
