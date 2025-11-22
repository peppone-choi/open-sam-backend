import { BaseAPI } from '../../common/BaseAPI';
import { Session } from '../../utils/Session';
import { DummySession } from '../../utils/DummySession';
import { Util } from '../../utils/Util';
import { TimeUtil } from '../../utils/TimeUtil';

interface ReqNonceResponse {
  result: boolean;
  loginNonce: string;
}

export class ReqNonceAPI extends BaseAPI {
  getRequiredSessionMode(): number {
    return BaseAPI.NO_LOGIN;
  }

  validateArgs(): string | null {
    return null;
  }

  launch(session: Session | DummySession): ReqNonceResponse {
    const loginNonce = Util.randomStr(16);
    const loginNonceExpired = TimeUtil.nowAddSeconds(2);

    if (session instanceof Session) {
      session.__set('loginNonce', loginNonce);
      session.__set('loginNonceExpired', loginNonceExpired);
    } else {
      session.set('loginNonce', loginNonce);
      session.set('loginNonceExpired', loginNonceExpired);
    }

    return {
      result: true,
      loginNonce,
    };
  }
}

export default ReqNonceAPI;
