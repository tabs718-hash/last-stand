/** One shared request per URL. Rejected requests are evicted and explicitly retryable. */
export class AssetCache<T> {
 private pending=new Map<string,Promise<T>>();private failed=new Set<string>();
 private statusListeners=new Set<()=>void>();private retryListeners=new Set<()=>void>();
 private retryVersion=0;private status={failedUrls:[] as readonly string[]};
 constructor(private loader:(url:string)=>Promise<T>){}
 load(url:string){
  const existing=this.pending.get(url);if(existing)return existing;
  const request=Promise.resolve().then(()=>this.loader(url));this.pending.set(url,request);
  void request.then(()=>{if(this.failed.delete(url))this.publish()},()=>{if(this.pending.get(url)===request)this.pending.delete(url);this.failed.add(url);this.publish()});return request;
 }
 private publish(){this.status={failedUrls:[...this.failed]};this.statusListeners.forEach(fn=>fn())}
 subscribeStatus=(fn:()=>void)=>{this.statusListeners.add(fn);return()=>{this.statusListeners.delete(fn)}};
 getStatus=()=>this.status;
 subscribeRetry=(fn:()=>void)=>{this.retryListeners.add(fn);return()=>{this.retryListeners.delete(fn)}};
 getRetryVersion=()=>this.retryVersion;
 retry=()=>{this.failed.clear();this.publish();this.retryVersion++;this.retryListeners.forEach(fn=>fn())};
}
