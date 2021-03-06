import {ReplaySubject, Subscription, Observable, Subject} from "rxjs";
import {ClientSocketService} from "../+admin/services/client-socket.service";
import {List} from "immutable";
import {IId} from "../../../../server/entities/id.interface";
import {ISocketItem} from "../../../../server/entities/socket-item.model";
import {GenericRestService} from "./generic-rest.service";
import {MyHttpInterface} from "./my-http.interface";
import {CacheService} from "./cache.service";

export class GenericService<T extends IId> implements CacheService<T>{
  items: ReplaySubject<List<T>> = new ReplaySubject<List<T>>(1);
  private currentItems: Map<string, T> = new Map<string, T>();
  private dataSubscription: Subscription;
  private restService: GenericRestService<T>;

  constructor(private myHttp: MyHttpInterface, private socketService: ClientSocketService,
              private restUrl: string, private socketNamespace: string) {
    this.restService = new GenericRestService<T>(myHttp, restUrl);
    let observable = socketService.get(socketNamespace);
    this.dataSubscription = observable.subscribe((item: ISocketItem) => this.processItem(item));
  }

  public disconnect() {
    this.dataSubscription.unsubscribe();
  }

  public getCache(id: string) {
    return this.currentItems.get(id);
  }

  public getRestService() {
    return this.restService;
  }

  private processItem(packet: ISocketItem) {
    if (packet.action === "create") {
      this.addItem(packet.item);
    } else if (packet.action === "update") {
      this.updateItem(packet.item);
    } else if (packet.action === "delete") {
      this.deleteItem(packet.item);
    }
  }

  public create(item: T) {
    this.restService.add(item).subscribe((item: T) => {
      this.addItem(item);
    }, (err: any) => this.items.error(err));
  }

  public update(item: T) {
    this.restService.update(item).subscribe((item: T) => {
      this.updateItem(item);
    }, (err: any) => this.items.error(err));
  }

  public del(id: string) {
    this.restService.del(id).subscribe((id: string) => {
      this.deleteItem(id);
    }, (err: any) => this.items.error(err));
  }

  public getAll(): Observable<T[]> {
    let subject = new Subject<T[]>();
    this.restService.getAll().subscribe((items: T[]) => {
      this.addAll(items);
      subject.next(items);
      subject.complete();
    }, (err: any) => {
      this.items.error(err);
      subject.error(err);
    });
    return subject;
  }

  private addAll(items: T[]) {
    this.currentItems = new Map<string, T>();
    for (let item of items) {
      this.currentItems.set(item.id, item);
    }
    this.items.next(List<T>(this.currentItems.values()));
  }

  private addItem(item: T) {
    if (!this.currentItems.has(item.id)) {
      this.currentItems.set(item.id, item);
      this.items.next(List<T>(this.currentItems.values()));
    }
  }

  private updateItem(item: T) {
    if (this.currentItems.get(item.id) !== item) {
      this.currentItems.set(item.id, item);
      this.items.next(List<T>(this.currentItems.values()));
    }
  }

  private deleteItem(id: string) {
    if (this.currentItems.has(id)) {
      this.currentItems.delete(id);
      this.items.next(List<T>(this.currentItems.values()));
    }
  }
}
