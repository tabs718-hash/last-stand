import {Component,type ReactNode} from 'react';
/** WebGL/asset render failures have an actionable UI and cannot leave combat running. */
export class GameErrorBoundary extends Component<{children:ReactNode;onError:()=>void},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 componentDidCatch(error:unknown){console.error('Game renderer failed',error);this.props.onError()}
 render(){return this.state.failed?<div className="loading game-error" role="alert"><div><strong>Не удалось запустить графику</strong><p>Обновите страницу. Если ошибка повторяется, проверьте поддержку WebGL и аппаратное ускорение браузера.</p><button className="primary" onClick={()=>window.location.reload()}>Перезапустить игру</button></div></div>:this.props.children}
}
