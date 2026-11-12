export class EventBus<Events extends object> {
  private listeners=new Map<keyof Events,Set<(payload:never)=>void>>();
  on<K extends keyof Events>(event:K,listener:(payload:Events[K])=>void){
    let listeners=this.listeners.get(event);
    if(!listeners){listeners=new Set();this.listeners.set(event,listeners)}
    listeners.add(listener as (payload:never)=>void);
    return ()=>{listeners!.delete(listener as (payload:never)=>void)};
  }
  emit<K extends keyof Events>(event:K,payload:Events[K]){
    for(const listener of [...(this.listeners.get(event)??[])])listener(payload as never);
  }
  clear(){this.listeners.clear()}
}
